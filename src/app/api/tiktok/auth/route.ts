import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  buildTikTokAuthorizeUrl,
  createTikTokOAuthState,
  tiktokOAuthConfigured,
  tiktokOAuthStateCookieOptions,
} from "@/lib/tiktok-oauth-state";

export const dynamic = "force-dynamic";

/**
 * Start TikTok Login Kit OAuth for the signed-in admin.
 * GET /api/tiktok/auth
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    const login = new URL("/admin/login", env.NEXT_PUBLIC_SITE_URL);
    login.searchParams.set("from", "/admin/settings");
    return NextResponse.redirect(login);
  }

  if (!tiktokOAuthConfigured()) {
    const settings = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
    settings.searchParams.set("tiktok", "missing_credentials");
    return NextResponse.redirect(settings);
  }

  const state = await createTikTokOAuthState();
  const authorizeUrl = buildTikTokAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, tiktokOAuthStateCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
