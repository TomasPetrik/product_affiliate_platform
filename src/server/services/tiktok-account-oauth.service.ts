import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  TIKTOK_ACCOUNT_CONNECTION_KEY,
  TIKTOK_ACCOUNT_REFRESH_URL,
  TIKTOK_ACCOUNT_REVOKE_URL,
  TIKTOK_ACCOUNT_TOKEN_URL,
  getTikTokAccountRedirectUri,
  tiktokAccountOAuthConfigured,
} from "@/lib/tiktok-account";
import { decryptSecret, encryptSecret } from "@/lib/token-crypto";
import type { TikTokAccountConnectionStatus } from "@/generated/prisma/enums";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class TikTokAccountAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly needsReauth = false,
  ) {
    super(message);
    this.name = "TikTokAccountAuthError";
  }
}

interface TikTokAccountTokenData {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: Array<string | number> | string;
  token_type?: string;
}

interface TikTokAccountApiEnvelope<T> {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
}

export interface TikTokAccountTokenResult {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresIn: number;
  refreshExpiresIn: number | null;
  scopes: string | null;
}

export interface TikTokAccountConnectionPublic {
  connected: boolean;
  status: TikTokAccountConnectionStatus | "NOT_CONNECTED";
  openId: string | null;
  displayName: string | null;
  scopes: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  oauthConfigured: boolean;
  connectedLabel: string | null;
}

function requireAppCredentials(): { clientId: string; clientSecret: string } {
  if (!env.TIKTOK_ADS_APP_ID || !env.TIKTOK_ADS_APP_SECRET) {
    throw new TikTokAccountAuthError(
      "TikTok Account OAuth is not configured. Set TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET.",
      "not_configured",
    );
  }
  return { clientId: env.TIKTOK_ADS_APP_ID, clientSecret: env.TIKTOK_ADS_APP_SECRET };
}

function normalizeScopes(value: Array<string | number> | string | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value || null;
  if (!value.length) return null;
  return value.map(String).join(",");
}

async function postJson<T>(url: string, body: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new TikTokAccountAuthError(
      error instanceof Error ? error.message : "Network error contacting TikTok Account API",
      "network_error",
    );
  }

  let envelope: TikTokAccountApiEnvelope<T>;
  try {
    envelope = (await response.json()) as TikTokAccountApiEnvelope<T>;
  } catch {
    throw new TikTokAccountAuthError(
      `Invalid JSON from TikTok Account API (HTTP ${response.status})`,
      "invalid_response",
    );
  }

  if (envelope.code !== 0 || !envelope.data) {
    const code = envelope.code != null ? String(envelope.code) : `http_${response.status}`;
    throw new TikTokAccountAuthError(
      envelope.message ?? `TikTok Account API error: ${code}`,
      code,
      code === "40105" || code === "40102" || code === "40107",
    );
  }

  return envelope.data;
}

function toTokenResult(data: TikTokAccountTokenData): TikTokAccountTokenResult {
  if (!data.access_token || !data.refresh_token || !data.open_id) {
    throw new TikTokAccountAuthError("Incomplete TikTok Account token response", "incomplete_token");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 86_400,
    refreshExpiresIn:
      typeof data.refresh_token_expires_in === "number" ? data.refresh_token_expires_in : null,
    scopes: normalizeScopes(data.scope),
  };
}

/**
 * Exchange a one-time account-holder auth_code for short-term tokens.
 * auth_code is valid for ~10 minutes and can be used only once.
 */
export async function exchangeTikTokAccountAuthCode(
  authCode: string,
): Promise<TikTokAccountTokenResult> {
  const { clientId, clientSecret } = requireAppCredentials();
  const data = await postJson<TikTokAccountTokenData>(TIKTOK_ACCOUNT_TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    auth_code: authCode,
    redirect_uri: getTikTokAccountRedirectUri(),
  });
  return toTokenResult(data);
}

async function refreshTikTokAccountAccessToken(
  refreshToken: string,
): Promise<TikTokAccountTokenResult> {
  const { clientId, clientSecret } = requireAppCredentials();
  const data = await postJson<TikTokAccountTokenData>(TIKTOK_ACCOUNT_REFRESH_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return toTokenResult(data);
}

export async function persistTikTokAccountTokens(
  token: TikTokAccountTokenResult,
  extras?: { displayName?: string | null },
): Promise<void> {
  const now = Date.now();
  const data = {
    openId: token.openId,
    displayName: extras?.displayName ?? undefined,
    accessTokenEnc: encryptSecret(token.accessToken),
    refreshTokenEnc: encryptSecret(token.refreshToken),
    accessTokenExpiresAt: new Date(now + token.expiresIn * 1000),
    refreshTokenExpiresAt:
      token.refreshExpiresIn != null ? new Date(now + token.refreshExpiresIn * 1000) : null,
    scopes: token.scopes,
    status: "CONNECTED" as const,
    lastError: null as string | null,
    lastSyncedAt: new Date(),
  };

  const existing = await prisma.tikTokAccountOAuthConnection.findUnique({
    where: { key: TIKTOK_ACCOUNT_CONNECTION_KEY },
  });

  if (existing) {
    await prisma.tikTokAccountOAuthConnection.update({
      where: { id: existing.id },
      data: {
        ...data,
        displayName: extras?.displayName !== undefined ? extras.displayName : existing.displayName,
      },
    });
  } else {
    await prisma.tikTokAccountOAuthConnection.create({
      data: {
        key: TIKTOK_ACCOUNT_CONNECTION_KEY,
        ...data,
        displayName: extras?.displayName ?? null,
      },
    });
  }
}

/**
 * Returns a valid Business Account access token, refreshing when near expiry.
 */
export async function getValidTikTokAccountAccessToken(): Promise<string> {
  const connection = await prisma.tikTokAccountOAuthConnection.findUnique({
    where: { key: TIKTOK_ACCOUNT_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    throw new TikTokAccountAuthError(
      "TikTok Account is not connected. Use Connect TikTok Account in Admin → Settings.",
      "not_connected",
      true,
    );
  }

  if (connection.status === "NEEDS_REAUTH") {
    throw new TikTokAccountAuthError(
      connection.lastError ?? "TikTok Account connection requires reauthorization.",
      "needs_reauth",
      true,
    );
  }

  const accessToken = decryptSecret(connection.accessTokenEnc);
  if (connection.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return accessToken;
  }

  try {
    const refreshed = await refreshTikTokAccountAccessToken(
      decryptSecret(connection.refreshTokenEnc),
    );
    await persistTikTokAccountTokens(refreshed, { displayName: connection.displayName });
    return refreshed.accessToken;
  } catch (error) {
    const message =
      error instanceof TikTokAccountAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "TikTok Account token refresh failed";
    const needsReauth = error instanceof TikTokAccountAuthError ? error.needsReauth : true;

    await prisma.tikTokAccountOAuthConnection.updateMany({
      where: { key: TIKTOK_ACCOUNT_CONNECTION_KEY },
      data: {
        status: needsReauth ? "NEEDS_REAUTH" : "CONNECTED",
        lastError: message.slice(0, 500),
      },
    });

    throw new TikTokAccountAuthError(
      message,
      error instanceof TikTokAccountAuthError ? error.code : "refresh_failed",
      true,
    );
  }
}

export async function getTikTokAccountConnectionPublic(): Promise<TikTokAccountConnectionPublic> {
  const oauthConfigured = tiktokAccountOAuthConfigured();
  const connection = await prisma.tikTokAccountOAuthConnection.findUnique({
    where: { key: TIKTOK_ACCOUNT_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    return {
      connected: false,
      status: "NOT_CONNECTED",
      openId: null,
      displayName: null,
      scopes: null,
      lastSyncedAt: null,
      lastError: null,
      oauthConfigured,
      connectedLabel: null,
    };
  }

  const connected = connection.status === "CONNECTED";
  return {
    connected,
    status: connection.status,
    openId: connection.openId,
    displayName: connection.displayName,
    scopes: connection.scopes,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    oauthConfigured,
    connectedLabel: connection.displayName ?? `Account ${connection.openId.slice(0, 8)}…`,
  };
}

export async function disconnectTikTokAccount(): Promise<void> {
  const connection = await prisma.tikTokAccountOAuthConnection.findUnique({
    where: { key: TIKTOK_ACCOUNT_CONNECTION_KEY },
  });
  if (!connection) return;

  if (tiktokAccountOAuthConfigured() && connection.status !== "DISCONNECTED") {
    try {
      const { clientId, clientSecret } = requireAppCredentials();
      await postJson<Record<string, unknown>>(TIKTOK_ACCOUNT_REVOKE_URL, {
        client_id: clientId,
        client_secret: clientSecret,
        access_token: decryptSecret(connection.accessTokenEnc),
      });
    } catch (error) {
      console.error("[tiktok-account-oauth] revoke failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
    }
  }

  await prisma.tikTokAccountOAuthConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEnc: encryptSecret("revoked"),
      refreshTokenEnc: encryptSecret("revoked"),
      lastError: null,
    },
  });
}
