import { env } from "@/lib/env";

/** Advertiser authorization page (Marketing API). */
export const TIKTOK_ADS_AUTHORIZE_URL = "https://business-api.tiktok.com/portal/auth";

/** Exchange auth_code for a long-term access token. */
export const TIKTOK_ADS_TOKEN_URL =
  "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";

/** Revoke a long-term Marketing API access token. */
export const TIKTOK_ADS_REVOKE_URL =
  "https://business-api.tiktok.com/open_api/v1.3/oauth2/revoke_token/";

/** List advertisers granted to an access token. */
export const TIKTOK_ADS_ADVERTISER_GET_URL =
  "https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/";

export const TIKTOK_ADS_OAUTH_STATE_COOKIE = "radarcut_tiktok_ads_oauth_state";
export const TIKTOK_ADS_CONNECTION_KEY = "default";

/**
 * Exact Advertiser redirect URL registered in TikTok API for Business → My Apps.
 * Must match character-for-character, including the trailing slash.
 * Production: https://radarcut.com/api/tiktok/oauth/callback/
 */
export function getTikTokAdsRedirectUri(): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/api/tiktok/oauth/callback/`;
}

export function tiktokAdsOAuthConfigured(): boolean {
  return Boolean(env.TIKTOK_ADS_APP_ID && env.TIKTOK_ADS_APP_SECRET);
}

export function buildTikTokAdsAuthorizeUrl(state: string): string {
  if (!env.TIKTOK_ADS_APP_ID) {
    throw new Error("TIKTOK_ADS_APP_ID is not configured");
  }

  const params = new URLSearchParams({
    app_id: env.TIKTOK_ADS_APP_ID,
    redirect_uri: getTikTokAdsRedirectUri(),
    state,
  });

  return `${TIKTOK_ADS_AUTHORIZE_URL}?${params.toString()}`;
}
