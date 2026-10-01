import { env } from "@/lib/env";

export const META_CONNECTION_KEY = "default";
export const META_OAUTH_STATE_COOKIE = "radarcut_meta_oauth_state";

/**
 * Permissions for Page + Instagram Professional marketing-video sync.
 * Used only when META_LOGIN_CONFIG_ID is unset (legacy Facebook Login scope list).
 * Prefer Facebook Login for Business + META_LOGIN_CONFIG_ID — Meta often rejects
 * these scopes on plain Facebook Login with "Invalid Scopes".
 */
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
].join(",");

export function getMetaGraphVersion(): string {
  return env.META_GRAPH_API_VERSION || "v22.0";
}

/** Exact redirect URI for Meta → Facebook Login → Valid OAuth Redirect URIs. */
export function getMetaRedirectUri(): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/api/meta/callback`;
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
 * Otherwise: classic scope-based Facebook Login (often fails with Invalid Scopes for
 * Page/Instagram permissions unless those products are enabled on the app).
 */
export function buildMetaAuthorizeUrl(state: string): string {
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

  if (env.META_LOGIN_CONFIG_ID) {
    params.set("config_id", env.META_LOGIN_CONFIG_ID);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", META_OAUTH_SCOPES);
    // Helps Instagram Graph API onboarding when using Facebook Login for Business docs.
    params.set("extras", JSON.stringify({ setup: { channel: "IG_API_ONBOARDING" } }));
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
