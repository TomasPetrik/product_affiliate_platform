import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  META_OAUTH_STATE_COOKIE,
  buildMetaAuthorizeUrl,
  createMetaOAuthState,
  metaOAuthConfigured,
  metaOAuthStateCookieOptions,
} from "@/lib/meta-oauth-state";

export const dynamic = "force-dynamic";

/** Start Meta / Facebook Login OAuth. GET /api/meta/auth
 *  Optional `?classic=1` skips META_LOGIN_CONFIG_ID and uses explicit scopes.
 */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    const login = new URL("/admin/login", env.NEXT_PUBLIC_SITE_URL);
    login.searchParams.set("from", "/admin/settings");
    return NextResponse.redirect(login);
  }

  if (!metaOAuthConfigured()) {
    const settings = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
    settings.searchParams.set("meta", "missing_credentials");
    return NextResponse.redirect(settings);
  }

  const forceClassic = new URL(request.url).searchParams.get("classic") === "1";
  const igOnly = new URL(request.url).searchParams.get("ig_only") === "1";
  const state = await createMetaOAuthState();
  const authorizeUrl = buildMetaAuthorizeUrl(state, {
    forceClassic: forceClassic || igOnly,
    igOnly,
  });
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, metaOAuthStateCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
