import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  TIKTOK_ADS_ADVERTISER_GET_URL,
  TIKTOK_ADS_CONNECTION_KEY,
  TIKTOK_ADS_REVOKE_URL,
  TIKTOK_ADS_TOKEN_URL,
  tiktokAdsOAuthConfigured,
} from "@/lib/tiktok-ads";
import { decryptSecret, encryptSecret } from "@/lib/token-crypto";
import type { TikTokAdsConnectionStatus } from "@/generated/prisma/enums";

export class TikTokAdsAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly needsReauth = false,
  ) {
    super(message);
    this.name = "TikTokAdsAuthError";
  }
}

interface TikTokAdsTokenData {
  access_token?: string;
  advertiser_ids?: Array<string | number>;
  scope?: Array<string | number> | string;
}

interface TikTokAdsApiEnvelope<T> {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
}

export interface TikTokAdsTokenResult {
  accessToken: string;
  advertiserIds: string[];
  scopes: string | null;
}

export interface TikTokAdsConnectionPublic {
  connected: boolean;
  status: TikTokAdsConnectionStatus | "NOT_CONNECTED";
  advertiserIds: string[];
  scopes: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  oauthConfigured: boolean;
  connectedLabel: string | null;
}

function requireAppCredentials(): { appId: string; secret: string } {
  if (!env.TIKTOK_ADS_APP_ID || !env.TIKTOK_ADS_APP_SECRET) {
    throw new TikTokAdsAuthError(
      "TikTok Ads OAuth is not configured. Set TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET.",
      "not_configured",
    );
  }
  return { appId: env.TIKTOK_ADS_APP_ID, secret: env.TIKTOK_ADS_APP_SECRET };
}

function normalizeIdList(value: Array<string | number> | undefined): string[] {
  if (!value?.length) return [];
  return value.map((id) => String(id));
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
    throw new TikTokAdsAuthError(
      error instanceof Error ? error.message : "Network error contacting TikTok Ads API",
      "network_error",
    );
  }

  let envelope: TikTokAdsApiEnvelope<T>;
  try {
    envelope = (await response.json()) as TikTokAdsApiEnvelope<T>;
  } catch {
    throw new TikTokAdsAuthError(
      `Invalid JSON from TikTok Ads API (HTTP ${response.status})`,
      "invalid_response",
    );
  }

  if (envelope.code !== 0 || !envelope.data) {
    const code = envelope.code != null ? String(envelope.code) : `http_${response.status}`;
    throw new TikTokAdsAuthError(
      envelope.message ?? `TikTok Ads API error: ${code}`,
      code,
      code === "40105" || code === "40102",
    );
  }

  return envelope.data;
}

/**
 * Exchange a one-time Marketing API auth_code for a long-term access token.
 * auth_code is valid for one hour and can be used only once.
 */
export async function exchangeTikTokAdsAuthCode(authCode: string): Promise<TikTokAdsTokenResult> {
  const { appId, secret } = requireAppCredentials();
  const data = await postJson<TikTokAdsTokenData>(TIKTOK_ADS_TOKEN_URL, {
    app_id: appId,
    secret,
    auth_code: authCode,
  });

  if (!data.access_token) {
    throw new TikTokAdsAuthError("Incomplete TikTok Ads token response", "incomplete_token");
  }

  return {
    accessToken: data.access_token,
    advertiserIds: normalizeIdList(data.advertiser_ids),
    scopes: normalizeScopes(data.scope),
  };
}

export async function persistTikTokAdsTokens(token: TikTokAdsTokenResult): Promise<void> {
  const data = {
    advertiserIds: JSON.stringify(token.advertiserIds),
    accessTokenEnc: encryptSecret(token.accessToken),
    accessTokenExpiresAt: null as Date | null,
    scopes: token.scopes,
    status: "CONNECTED" as const,
    lastError: null as string | null,
    lastSyncedAt: new Date(),
  };

  const existing = await prisma.tikTokAdsOAuthConnection.findUnique({
    where: { key: TIKTOK_ADS_CONNECTION_KEY },
  });

  if (existing) {
    await prisma.tikTokAdsOAuthConnection.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.tikTokAdsOAuthConnection.create({
      data: {
        key: TIKTOK_ADS_CONNECTION_KEY,
        ...data,
      },
    });
  }
}

export async function getValidTikTokAdsAccessToken(): Promise<string> {
  const connection = await prisma.tikTokAdsOAuthConnection.findUnique({
    where: { key: TIKTOK_ADS_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    throw new TikTokAdsAuthError(
      "TikTok Ads is not connected. Use Connect TikTok Ads in Admin → Settings.",
      "not_connected",
      true,
    );
  }

  if (connection.status === "NEEDS_REAUTH") {
    throw new TikTokAdsAuthError(
      connection.lastError ?? "TikTok Ads connection requires reauthorization.",
      "needs_reauth",
      true,
    );
  }

  return decryptSecret(connection.accessTokenEnc);
}

export async function getTikTokAdsConnectionPublic(): Promise<TikTokAdsConnectionPublic> {
  const oauthConfigured = tiktokAdsOAuthConfigured();
  const connection = await prisma.tikTokAdsOAuthConnection.findUnique({
    where: { key: TIKTOK_ADS_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    return {
      connected: false,
      status: "NOT_CONNECTED",
      advertiserIds: [],
      scopes: null,
      lastSyncedAt: null,
      lastError: null,
      oauthConfigured,
      connectedLabel: null,
    };
  }

  let advertiserIds: string[] = [];
  try {
    advertiserIds = JSON.parse(connection.advertiserIds) as string[];
    if (!Array.isArray(advertiserIds)) advertiserIds = [];
  } catch {
    advertiserIds = [];
  }

  const connected = connection.status === "CONNECTED";
  return {
    connected,
    status: connection.status,
    advertiserIds,
    scopes: connection.scopes,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    oauthConfigured,
    connectedLabel: advertiserIds.length
      ? `Advertiser ${advertiserIds[0]}${advertiserIds.length > 1 ? ` (+${advertiserIds.length - 1})` : ""}`
      : "TikTok Ads",
  };
}

export async function disconnectTikTokAds(): Promise<void> {
  const connection = await prisma.tikTokAdsOAuthConnection.findUnique({
    where: { key: TIKTOK_ADS_CONNECTION_KEY },
  });
  if (!connection) return;

  if (tiktokAdsOAuthConfigured() && connection.status !== "DISCONNECTED") {
    try {
      const { appId, secret } = requireAppCredentials();
      const accessToken = decryptSecret(connection.accessTokenEnc);
      await postJson<Record<string, unknown>>(TIKTOK_ADS_REVOKE_URL, {
        app_id: appId,
        secret,
        access_token: accessToken,
      });
    } catch (error) {
      console.error("[tiktok-ads-oauth] revoke failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
    }
  }

  await prisma.tikTokAdsOAuthConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEnc: encryptSecret("revoked"),
      advertiserIds: "[]",
      lastError: null,
    },
  });
}

/** Optional sanity check: list advertisers reachable with the stored token. */
export async function refreshTikTokAdsAdvertiserIds(): Promise<string[]> {
  const { appId, secret } = requireAppCredentials();
  const accessToken = await getValidTikTokAdsAccessToken();

  const url = new URL(TIKTOK_ADS_ADVERTISER_GET_URL);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("secret", secret);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new TikTokAdsAuthError(
      error instanceof Error ? error.message : "Network error listing TikTok advertisers",
      "network_error",
    );
  }

  let envelope: TikTokAdsApiEnvelope<{ list?: Array<{ advertiser_id?: string | number }> }>;
  try {
    envelope = (await response.json()) as typeof envelope;
  } catch {
    throw new TikTokAdsAuthError(
      `Invalid JSON from TikTok advertiser list (HTTP ${response.status})`,
      "invalid_response",
    );
  }

  if (envelope.code !== 0) {
    throw new TikTokAdsAuthError(
      envelope.message ?? `TikTok advertiser list error: ${envelope.code}`,
      String(envelope.code ?? response.status),
      true,
    );
  }

  const ids = (envelope.data?.list ?? [])
    .map((row) => (row.advertiser_id != null ? String(row.advertiser_id) : null))
    .filter((id): id is string => Boolean(id));

  await prisma.tikTokAdsOAuthConnection.updateMany({
    where: { key: TIKTOK_ADS_CONNECTION_KEY },
    data: {
      advertiserIds: JSON.stringify(ids),
      lastSyncedAt: new Date(),
      lastError: null,
      status: "CONNECTED",
    },
  });

  return ids;
}
