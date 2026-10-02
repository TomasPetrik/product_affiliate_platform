import { env } from "@/lib/env";
import {
  META_CONNECTION_KEY,
  META_OAUTH_SCOPES,
  getMetaRedirectUri,
  metaGraphUrl,
  metaOAuthConfigured,
} from "@/lib/meta";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/token-crypto";
import type { MetaConnectionStatus } from "@/generated/prisma/enums";

export class MetaAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly needsReauth = false,
  ) {
    super(message);
    this.name = "MetaAuthError";
  }
}

interface MetaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; type?: string; code?: number };
}

interface MetaPageRow {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string; username?: string };
}

export interface MetaConnectionPublic {
  connected: boolean;
  status: MetaConnectionStatus | "NOT_CONNECTED";
  facebookUserName: string | null;
  pageId: string | null;
  pageName: string | null;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  scopes: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  oauthConfigured: boolean;
  connectedLabel: string | null;
}

function requireAppCredentials(): { appId: string; appSecret: string } {
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new MetaAuthError(
      "Meta OAuth is not configured. Set META_APP_ID and META_APP_SECRET.",
      "not_configured",
    );
  }
  return { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET };
}

async function graphGet<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
  } catch (error) {
    throw new MetaAuthError(
      error instanceof Error ? error.message : "Network error contacting Meta Graph API",
      "network_error",
    );
  }

  let data: T & { error?: { message?: string; type?: string; code?: number } };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new MetaAuthError(`Invalid JSON from Meta (HTTP ${response.status})`, "invalid_response");
  }

  if (!response.ok || data.error) {
    const message = data.error?.message ?? `Meta Graph error HTTP ${response.status}`;
    const code = String(data.error?.code ?? response.status);
    const needsReauth =
      code === "190" ||
      message.toLowerCase().includes("session has expired") ||
      message.toLowerCase().includes("invalid oauth");
    throw new MetaAuthError(message, code, needsReauth);
  }

  return data;
}

export async function exchangeMetaAuthorizationCode(code: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = requireAppCredentials();
  const url = metaGraphUrl("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: getMetaRedirectUri(),
    code,
  });
  return graphGet<MetaTokenResponse>(url);
}

async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = requireAppCredentials();
  const url = metaGraphUrl("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  return graphGet<MetaTokenResponse>(url);
}

async function fetchFacebookUser(userToken: string): Promise<{ id: string; name?: string }> {
  const url = metaGraphUrl("/me", {
    fields: "id,name",
    access_token: userToken,
  });
  return graphGet<{ id: string; name?: string }>(url);
}

async function fetchManagedPages(userToken: string): Promise<MetaPageRow[]> {
  const url = metaGraphUrl("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userToken,
  });
  const data = await graphGet<{ data?: MetaPageRow[] }>(url);
  return data.data ?? [];
}

function pickRadarCutPage(pages: MetaPageRow[]): MetaPageRow {
  if (pages.length === 0) {
    throw new MetaAuthError(
      "No Facebook Pages were returned for this user. Confirm Pages_show_list and that you admin a Page.",
      "no_pages",
    );
  }

  const preferredId = env.META_PAGE_ID?.trim();
  if (preferredId) {
    const match = pages.find((page) => page.id === preferredId);
    if (match) return match;
    const available = pages.map((page) => `${page.name ?? "?"} (${page.id})`).join(", ");
    throw new MetaAuthError(
      `META_PAGE_ID=${preferredId} was not in the Pages you granted. Available: ${available}. In the Meta login dialog, choose the RadarCut Page (and its Instagram), then reconnect.`,
      "preferred_page_missing",
    );
  }

  const byName = pages.find((page) => /radarcut/i.test(page.name ?? ""));
  if (byName) return byName;

  const withIg = pages.find((page) => page.instagram_business_account?.id);
  if (withIg) return withIg;

  return pages[0];
}

export async function completeMetaOAuth(code: string): Promise<void> {
  const shortLived = await exchangeMetaAuthorizationCode(code);
  if (!shortLived.access_token) {
    throw new MetaAuthError("Meta token response missing access_token", "incomplete_token");
  }

  const longLived = await exchangeForLongLivedUserToken(shortLived.access_token);
  if (!longLived.access_token) {
    throw new MetaAuthError("Meta long-lived token exchange failed", "ll_token_failed");
  }

  const user = await fetchFacebookUser(longLived.access_token);
  const pages = await fetchManagedPages(longLived.access_token);
  const page = pickRadarCutPage(pages);

  if (!page.access_token) {
    throw new MetaAuthError("Selected Facebook Page did not include an access token", "no_page_token");
  }

  const ig = page.instagram_business_account;
  const userTokenExpiresAt =
    typeof longLived.expires_in === "number" && longLived.expires_in > 0
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;

  const data = {
    facebookUserId: user.id,
    facebookUserName: user.name ?? null,
    pageId: page.id,
    pageName: page.name ?? null,
    pageAccessTokenEnc: encryptSecret(page.access_token),
    userAccessTokenEnc: encryptSecret(longLived.access_token),
    userTokenExpiresAt,
    pageTokenExpiresAt: null as Date | null,
    instagramBusinessAccountId: ig?.id ?? null,
    instagramUsername: ig?.username ?? null,
    scopes: META_OAUTH_SCOPES,
    status: "CONNECTED" as const,
    lastError: null,
  };

  const existing = await prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
    select: { id: true },
  });

  if (existing) {
    await prisma.metaOAuthConnection.update({ where: { id: existing.id }, data });
  } else {
    await prisma.metaOAuthConnection.create({
      data: { key: META_CONNECTION_KEY, ...data },
    });
  }

  try {
    await subscribeMetaPageToWebhooks(page.id, page.access_token);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Page webhook subscription failed";
    await prisma.metaOAuthConnection.updateMany({
      where: { key: META_CONNECTION_KEY },
      data: { lastError: `Connected, but webhook subscribe failed: ${message}`.slice(0, 500) },
    });
  }
}

/**
 * Subscribe the connected Page so Meta delivers feed (FB comments) webhooks.
 * Instagram `comments` are configured on the Instagram object in App Dashboard;
 * Page subscription is still required for the Facebook Login path.
 */
export async function subscribeMetaPageToWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<void> {
  const url = metaGraphUrl(`/${pageId}/subscribed_apps`, {
    access_token: pageAccessToken,
    // feed = Page comments/posts; messages helps Messenger-related delivery for private replies
    subscribed_fields: "feed,messages",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new MetaAuthError(
      error instanceof Error ? error.message : "Failed to subscribe Page to webhooks",
      "webhook_subscribe_network",
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { message?: string };
  };

  if (!response.ok || data.error || data.success === false) {
    throw new MetaAuthError(
      data.error?.message ?? `Page webhook subscription failed (HTTP ${response.status})`,
      "webhook_subscribe_failed",
    );
  }
}

async function markNeedsReauth(message: string): Promise<void> {
  await prisma.metaOAuthConnection.updateMany({
    where: { key: META_CONNECTION_KEY },
    data: {
      status: "NEEDS_REAUTH",
      lastError: message.slice(0, 500),
    },
  });
}

/**
 * Returns the Page access token used for Instagram + Facebook Graph calls.
 * Prefers OAuth DB connection; falls back to deprecated META_ACCESS_TOKEN env.
 */
export async function getValidMetaPageAccessToken(): Promise<string> {
  const connection = await prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    if (env.META_ACCESS_TOKEN) {
      return env.META_ACCESS_TOKEN;
    }
    throw new MetaAuthError(
      "Meta is not connected. Use Connect Meta in Admin → Settings.",
      "not_connected",
      true,
    );
  }

  if (connection.status === "NEEDS_REAUTH") {
    throw new MetaAuthError(
      connection.lastError ?? "Meta connection requires reauthorization.",
      "needs_reauth",
      true,
    );
  }

  return decryptSecret(connection.pageAccessTokenEnc);
}

export async function isMetaSyncConfigured(): Promise<boolean> {
  if (env.META_ACCESS_TOKEN) return true;
  const connection = await prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
    select: { status: true },
  });
  return connection?.status === "CONNECTED";
}

export async function getMetaConnectionPublic(): Promise<MetaConnectionPublic> {
  const oauthConfigured = metaOAuthConfigured();
  const connection = await prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    return {
      connected: false,
      status: "NOT_CONNECTED",
      facebookUserName: null,
      pageId: null,
      pageName: null,
      instagramBusinessAccountId: null,
      instagramUsername: null,
      scopes: null,
      lastSyncedAt: null,
      lastError: null,
      oauthConfigured,
      connectedLabel: null,
    };
  }

  const igLabel = connection.instagramUsername
    ? connection.instagramUsername.startsWith("@")
      ? connection.instagramUsername
      : `@${connection.instagramUsername}`
    : null;

  return {
    connected: connection.status === "CONNECTED",
    status: connection.status,
    facebookUserName: connection.facebookUserName,
    pageId: connection.pageId,
    pageName: connection.pageName,
    instagramBusinessAccountId: connection.instagramBusinessAccountId,
    instagramUsername: connection.instagramUsername,
    scopes: connection.scopes,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    oauthConfigured,
    connectedLabel: igLabel ?? connection.pageName ?? connection.facebookUserName,
  };
}

export async function getMetaConnectionInternal() {
  return prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
  });
}

export async function disconnectMeta(): Promise<void> {
  const connection = await prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
  });
  if (!connection) return;

  if (metaOAuthConfigured() && connection.status !== "DISCONNECTED") {
    try {
      const userToken = decryptSecret(connection.userAccessTokenEnc);
      await fetch(metaGraphUrl("/me/permissions", { access_token: userToken }), {
        method: "DELETE",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Revoke is best-effort; we still clear local tokens.
    }
  }

  await prisma.metaOAuthConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      pageAccessTokenEnc: encryptSecret("revoked"),
      userAccessTokenEnc: encryptSecret("revoked"),
      lastError: null,
    },
  });

  await prisma.metaCachedMedia.deleteMany();
}

export async function refreshMetaPageDiscovery(): Promise<void> {
  const connection = await prisma.metaOAuthConnection.findUnique({
    where: { key: META_CONNECTION_KEY },
  });
  if (!connection || connection.status !== "CONNECTED") {
    throw new MetaAuthError("Meta is not connected", "not_connected", true);
  }

  try {
    const userToken = decryptSecret(connection.userAccessTokenEnc);
    const pages = await fetchManagedPages(userToken);
    const page = pickRadarCutPage(pages);
    if (!page.access_token) {
      throw new MetaAuthError("Page token missing on refresh", "no_page_token", true);
    }

    await prisma.metaOAuthConnection.update({
      where: { id: connection.id },
      data: {
        pageId: page.id,
        pageName: page.name ?? null,
        pageAccessTokenEnc: encryptSecret(page.access_token),
        instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
        instagramUsername: page.instagram_business_account?.username ?? null,
        status: "CONNECTED",
        lastError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof MetaAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Meta page refresh failed";
    if (error instanceof MetaAuthError && error.needsReauth) {
      await markNeedsReauth(message);
    }
    throw error instanceof MetaAuthError
      ? error
      : new MetaAuthError(message, "refresh_failed", true);
  }
}
