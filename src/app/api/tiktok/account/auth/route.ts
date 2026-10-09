import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE,
  buildTikTokAccountAuthorizeUrl,
  createTikTokAccountOAuthState,
  tiktokAccountOAuthConfigured,
  tiktokAccountOAuthStateCookieOptions,
} from "@/lib/tiktok-account-oauth-state";

export const dynamic = "force-dynamic";

/**
 * Start TikTok account holder (Business Account) OAuth for the signed-in admin.
 * GET /api/tiktok/account/auth
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    const login = new URL("/admin/login", env.NEXT_PUBLIC_SITE_URL);
    login.searchParams.set("from", "/admin/settings");
    return NextResponse.redirect(login);
  }

  if (!tiktokAccountOAuthConfigured()) {
    const settings = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
    settings.searchParams.set("tiktok_account", "missing_credentials");
    return NextResponse.redirect(settings);
  }

  const state = await createTikTokAccountOAuthState();
  const authorizeUrl = buildTikTokAccountAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE,
    state,
    tiktokAccountOAuthStateCookieOptions(),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
