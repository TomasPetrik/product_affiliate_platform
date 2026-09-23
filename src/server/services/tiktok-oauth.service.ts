import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  TIKTOK_CONNECTION_KEY,
  TIKTOK_REVOKE_URL,
  TIKTOK_TOKEN_URL,
  TIKTOK_USER_INFO_FIELDS,
  TIKTOK_USER_INFO_URL,
  getTikTokRedirectUri,
  tiktokOAuthConfigured,
} from "@/lib/tiktok";
import { decryptSecret, encryptSecret } from "@/lib/token-crypto";
import type { TikTokConnectionStatus } from "@/generated/prisma/enums";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class TikTokAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly needsReauth = false,
  ) {
    super(message);
    this.name = "TikTokAuthError";
  }
}

interface TikTokTokenResponse {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  log_id?: string;
}

export interface TikTokConnectionPublic {
  connected: boolean;
  status: TikTokConnectionStatus | "NOT_CONNECTED";
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  openId: string | null;
  scopes: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  oauthConfigured: boolean;
  /** Label for admin UI, e.g. "@radarcut" or display name. */
  connectedLabel: string | null;
}

function requireClientCredentials(): { clientKey: string; clientSecret: string } {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new TikTokAuthError(
      "TikTok OAuth is not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.",
      "not_configured",
    );
  }
  return { clientKey: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET };
}

async function postTokenForm(body: Record<string, string>): Promise<TikTokTokenResponse> {
  let response: Response;
  try {
    response = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams(body).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new TikTokAuthError(
      error instanceof Error ? error.message : "Network error contacting TikTok token endpoint",
      "network_error",
    );
  }

  let data: TikTokTokenResponse;
  try {
    data = (await response.json()) as TikTokTokenResponse;
  } catch {
    throw new TikTokAuthError(`Invalid JSON from TikTok token endpoint (HTTP ${response.status})`, "invalid_response");
  }

  if (data.error || !data.access_token || !data.refresh_token) {
    const code = data.error ?? `http_${response.status}`;
    const needsReauth =
      code === "invalid_grant" ||
      code === "access_denied" ||
      code === "invalid_scope" ||
      code === "invalid_client";
    throw new TikTokAuthError(
      data.error_description ?? `TikTok token error: ${code}`,
      code,
      needsReauth,
    );
  }

  return data;
}

export async function exchangeAuthorizationCode(code: string): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret } = requireClientCredentials();
  return postTokenForm({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: getTikTokRedirectUri(),
  });
}

async function refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret } = requireClientCredentials();
  return postTokenForm({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function fetchUserProfile(accessToken: string): Promise<{
  openId: string;
  displayName: string | null;
  avatarUrl: string | null;
}> {
  const url = `${TIKTOK_USER_INFO_URL}?fields=${encodeURIComponent(TIKTOK_USER_INFO_FIELDS)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await response.json()) as {
    data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
    error?: { code?: string; message?: string };
  };

  if (!response.ok || (body.error?.code && body.error.code !== "ok")) {
    throw new TikTokAuthError(
      body.error?.message ?? `Failed to fetch TikTok user info (HTTP ${response.status})`,
      body.error?.code ?? "user_info_failed",
    );
  }

  const user = body.data?.user;
  return {
    openId: user?.open_id ?? "",
    displayName: user?.display_name ?? null,
    avatarUrl: user?.avatar_url ?? null,
  };
}

function expiresAtFromSeconds(expiresIn: number | undefined, fallbackSeconds: number): Date {
  const seconds = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : fallbackSeconds;
  return new Date(Date.now() + seconds * 1000);
}

export async function persistTikTokTokens(
  token: TikTokTokenResponse,
  options?: { username?: string | null },
): Promise<void> {
  if (!token.access_token || !token.refresh_token || !token.open_id) {
    throw new TikTokAuthError("Incomplete TikTok token response", "incomplete_token");
  }

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const profile = await fetchUserProfile(token.access_token);
    displayName = profile.displayName;
    avatarUrl = profile.avatarUrl;
  } catch {
    // Profile is best-effort; tokens still save.
  }

  const accessTokenExpiresAt = expiresAtFromSeconds(token.expires_in, 86_400);
  const refreshTokenExpiresAt =
    typeof token.refresh_expires_in === "number"
      ? expiresAtFromSeconds(token.refresh_expires_in, 31_536_000)
      : null;

  const existing = await prisma.tikTokOAuthConnection.findUnique({
    where: { key: TIKTOK_CONNECTION_KEY },
    select: { id: true, username: true },
  });

  const data = {
    openId: token.open_id,
    displayName,
    username: options?.username ?? existing?.username ?? null,
    avatarUrl,
    accessTokenEnc: encryptSecret(token.access_token),
    refreshTokenEnc: encryptSecret(token.refresh_token),
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    scopes: token.scope ?? "user.info.basic,video.list",
    status: "CONNECTED" as const,
    lastError: null,
  };

  if (existing) {
    await prisma.tikTokOAuthConnection.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.tikTokOAuthConnection.create({
      data: {
        key: TIKTOK_CONNECTION_KEY,
        ...data,
      },
    });
  }
}

async function markNeedsReauth(message: string): Promise<void> {
  await prisma.tikTokOAuthConnection.updateMany({
    where: { key: TIKTOK_CONNECTION_KEY },
    data: {
      status: "NEEDS_REAUTH",
      lastError: message.slice(0, 500),
    },
  });
}

/**
 * Returns a valid TikTok user access token, refreshing when near expiry.
 * Never logs the token value.
 */
export async function getValidTikTokAccessToken(): Promise<string> {
  const connection = await prisma.tikTokOAuthConnection.findUnique({
    where: { key: TIKTOK_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    // Deprecated env fallback for emergency / migration only.
    if (env.TIKTOK_ACCESS_TOKEN) {
      return env.TIKTOK_ACCESS_TOKEN;
    }
    throw new TikTokAuthError(
      "TikTok is not connected. Use Connect TikTok in Admin → Settings.",
      "not_connected",
      true,
    );
  }

  if (connection.status === "NEEDS_REAUTH") {
    throw new TikTokAuthError(
      connection.lastError ?? "TikTok connection requires reauthorization.",
      "needs_reauth",
      true,
    );
  }

  const stillValid =
    connection.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_TOKEN_REFRESH_SKEW_MS;

  if (stillValid) {
    return decryptSecret(connection.accessTokenEnc);
  }

  try {
    const refreshToken = decryptSecret(connection.refreshTokenEnc);
    const refreshed = await refreshAccessToken(refreshToken);
    await persistTikTokTokens(refreshed, { username: connection.username });
    return refreshed.access_token!;
  } catch (error) {
    const message =
      error instanceof TikTokAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "TikTok token refresh failed";
    const needsReauth = error instanceof TikTokAuthError ? error.needsReauth : true;
    if (needsReauth) {
      await markNeedsReauth(message);
    }
    throw new TikTokAuthError(message, error instanceof TikTokAuthError ? error.code : "refresh_failed", true);
  }
}

export async function isTikTokSyncConfigured(): Promise<boolean> {
  if (env.TIKTOK_ACCESS_TOKEN) return true;
  const connection = await prisma.tikTokOAuthConnection.findUnique({
    where: { key: TIKTOK_CONNECTION_KEY },
    select: { status: true },
  });
  return connection?.status === "CONNECTED";
}

export async function getTikTokConnectionPublic(): Promise<TikTokConnectionPublic> {
  const oauthConfigured = tiktokOAuthConfigured();
  const connection = await prisma.tikTokOAuthConnection.findUnique({
    where: { key: TIKTOK_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    return {
      connected: false,
      status: "NOT_CONNECTED",
      displayName: null,
      username: null,
      avatarUrl: null,
      openId: null,
      scopes: null,
      lastSyncedAt: null,
      lastError: null,
      oauthConfigured,
      connectedLabel: null,
    };
  }

  const label = connection.username
    ? connection.username.startsWith("@")
      ? connection.username
      : `@${connection.username}`
    : connection.displayName;

  return {
    connected: connection.status === "CONNECTED",
    status: connection.status,
    displayName: connection.displayName,
    username: connection.username,
    avatarUrl: connection.avatarUrl,
    openId: connection.openId,
    scopes: connection.scopes,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    oauthConfigured,
    connectedLabel: label,
  };
}

export async function updateTikTokUsernameHint(username: string | null): Promise<void> {
  if (!username) return;
  const normalized = username.replace(/^@/, "").trim();
  if (!normalized) return;
  await prisma.tikTokOAuthConnection.updateMany({
    where: { key: TIKTOK_CONNECTION_KEY, username: null },
    data: { username: normalized },
  });
}

export async function disconnectTikTok(): Promise<void> {
  const connection = await prisma.tikTokOAuthConnection.findUnique({
    where: { key: TIKTOK_CONNECTION_KEY },
  });
  if (!connection) return;

  if (tiktokOAuthConfigured() && connection.status !== "DISCONNECTED") {
    try {
      const { clientKey, clientSecret } = requireClientCredentials();
      const accessToken = decryptSecret(connection.accessTokenEnc);
      await fetch(TIKTOK_REVOKE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          token: accessToken,
        }).toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Revoke is best-effort; we still clear local tokens.
    }
  }

  await prisma.tikTokOAuthConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEnc: encryptSecret("revoked"),
      refreshTokenEnc: encryptSecret("revoked"),
      lastError: null,
    },
  });

  await prisma.tikTokCachedVideo.deleteMany();
}
