import { env } from "@/lib/env";

/**
 * Exchange account-holder auth_code for a short-term Business Account token.
 * @see https://business-api.tiktok.com/portal/docs/obtain-a-short-term-access-token/v1.3
 */
export const TIKTOK_ACCOUNT_TOKEN_URL =
  "https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/";

/** Renew a short-term Business Account access token. */
export const TIKTOK_ACCOUNT_REFRESH_URL =
  "https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/refresh_token/";

/** Revoke a short-term Business Account access token. */
export const TIKTOK_ACCOUNT_REVOKE_URL =
  "https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/revoke/";

export const TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE = "radarcut_tiktok_account_oauth_state";
export const TIKTOK_ACCOUNT_CONNECTION_KEY = "default";

/**
 * Exact TikTok account holder redirect URL registered in
 * TikTok API for Business → My Apps → Basic Information.
 * Must match character-for-character, including the trailing slash.
 * Production: https://radarcut.com/api/tiktok/account/callback/
 */
export function getTikTokAccountRedirectUri(): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/api/tiktok/account/callback/`;
}

/**
 * Same developer app credentials as Marketing API advertiser OAuth
 * (TIKTOK_ADS_APP_ID / TIKTOK_ADS_APP_SECRET).
 */
export function tiktokAccountOAuthConfigured(): boolean {
  return Boolean(env.TIKTOK_ADS_APP_ID && env.TIKTOK_ADS_APP_SECRET);
}

/**
 * Build a start URL for account-holder authorization.
 *
 * Prefer the portal-generated "TikTok account holder authorization URL"
 * (set TIKTOK_ACCOUNT_AUTHORIZATION_URL). When unset, fall back to the
 * Business portal auth page with our registered redirect_uri — TikTok may
 * still require the portal-generated URL for some apps.
 */
export function buildTikTokAccountAuthorizeUrl(state: string): string {
  if (!env.TIKTOK_ADS_APP_ID) {
    throw new Error("TIKTOK_ADS_APP_ID is not configured");
  }

  const redirectUri = getTikTokAccountRedirectUri();

  if (env.TIKTOK_ACCOUNT_AUTHORIZATION_URL) {
    const url = new URL(env.TIKTOK_ACCOUNT_AUTHORIZATION_URL);
    url.searchParams.set("state", state);
    // Ensure redirect matches our registered callback when the portal URL allows overrides.
    if (!url.searchParams.get("redirect_uri")) {
      url.searchParams.set("redirect_uri", redirectUri);
    }
    return url.toString();
  }

  const params = new URLSearchParams({
    app_id: env.TIKTOK_ADS_APP_ID,
    redirect_uri: redirectUri,
    state,
  });
  return `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
}
