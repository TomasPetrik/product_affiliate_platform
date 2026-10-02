import { env } from "@/lib/env";

export const META_CONNECTION_KEY = "default";
export const META_OAUTH_STATE_COOKIE = "radarcut_meta_oauth_state";

/**
 * Permissions for Page + Instagram Professional marketing-video sync and
 * keyword comment auto-replies.
 * Used only when META_LOGIN_CONFIG_ID is unset (legacy Facebook Login scope list)
 * or when Connect (classic scopes) is used.
 * Prefer Facebook Login for Business + META_LOGIN_CONFIG_ID — Meta often rejects
 * these scopes on plain Facebook Login with "Invalid Scopes".
 * Add the same permissions to your Login Configuration / use case in Meta Developers.
 *
 * Note: requesting `pages_manage_engagement` causes Meta to also require
 * `pages_read_user_content` as a dependency — both must be Ready/approved on the app.
 */
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_metadata",
  "pages_manage_engagement",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_comments",
].join(",");

/** Classic OAuth without Facebook Page comment management (avoids pages_read_user_content). */
export const META_OAUTH_SCOPES_IG_ONLY = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_comments",
].join(",");

export function getMetaGraphVersion(): string {
  return env.META_GRAPH_API_VERSION || "v22.0";
}

/** Exact redirect URI for Meta → Facebook Login → Valid OAuth Redirect URIs. */
export function getMetaRedirectUri(): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/api/meta/callback`;
}

/** Exact webhook callback URL for Meta App Dashboard → Webhooks. */
export function getMetaWebhookCallbackUrl(): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/api/meta/webhooks`;
}

export function metaOAuthConfigured(): boolean {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET);
}

/**
 * Build the Facebook OAuth dialog URL.
 *
 * When META_LOGIN_CONFIG_ID is set (recommended): Facebook Login for Business.
 * Permissions come from the Login Configuration in Meta Developers — do not pass scope.
 *
 * Otherwise (or when forceClassic is true): classic scope-based Facebook Login.
 * Useful as a fallback when Login for Business shows Meta's generic
 * "Sorry, something went wrong" dialog after publish.
 */
export function buildMetaAuthorizeUrl(
  state: string,
  options?: { forceClassic?: boolean; igOnly?: boolean },
): string {
  if (!env.META_APP_ID) {
    throw new Error("META_APP_ID is not configured");
  }

  const version = getMetaGraphVersion();
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: getMetaRedirectUri(),
    state,
    response_type: "code",
  });

  const useLoginConfig =
    Boolean(env.META_LOGIN_CONFIG_ID) && !options?.forceClassic && !options?.igOnly;

  if (useLoginConfig) {
    params.set("config_id", env.META_LOGIN_CONFIG_ID!);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", options?.igOnly ? META_OAUTH_SCOPES_IG_ONLY : META_OAUTH_SCOPES);
    params.set("auth_type", "rerequest");
  }

  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}

export function metaGraphUrl(path: string, query?: Record<string, string>): string {
  const version = getMetaGraphVersion();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`https://graph.facebook.com/${version}${normalized}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
