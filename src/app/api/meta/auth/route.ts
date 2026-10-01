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

/** Start Meta / Facebook Login OAuth. GET /api/meta/auth */
export async function GET() {
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

  const state = await createMetaOAuthState();
  const authorizeUrl = buildMetaAuthorizeUrl(state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, metaOAuthStateCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
