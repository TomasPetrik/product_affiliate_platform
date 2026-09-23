import { env } from "@/lib/env";

export const TIKTOK_OAUTH_SCOPES = "user.info.basic,video.list" as const;
export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
export const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
export const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
export const TIKTOK_VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";

export const TIKTOK_OAUTH_STATE_COOKIE = "radarcut_tiktok_oauth_state";
export const TIKTOK_CONNECTION_KEY = "default";

/** Fields requested from video.list / video.query (Display API). */
export const TIKTOK_VIDEO_FIELDS =
  "id,title,video_description,share_url,create_time,view_count" as const;

export const TIKTOK_USER_INFO_FIELDS = "open_id,display_name,avatar_url" as const;

/**
 * Exact redirect URI registered in TikTok Developer Portal → Login Kit.
 * Must match character-for-character (no trailing slash).
 */
export function getTikTokRedirectUri(): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/api/tiktok/callback`;
}

export function tiktokOAuthConfigured(): boolean {
  return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
}

export function buildTikTokAuthorizeUrl(state: string): string {
  if (!env.TIKTOK_CLIENT_KEY) {
    throw new Error("TIKTOK_CLIENT_KEY is not configured");
  }

  const params = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: TIKTOK_OAUTH_SCOPES,
    redirect_uri: getTikTokRedirectUri(),
    state,
  });

  return `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`;
}
