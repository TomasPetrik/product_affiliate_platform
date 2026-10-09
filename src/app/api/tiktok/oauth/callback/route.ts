import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  TIKTOK_ADS_OAUTH_STATE_COOKIE,
  statesMatch,
  tiktokAdsOAuthStateCookieOptions,
  verifyTikTokAdsOAuthState,
} from "@/lib/tiktok-ads-oauth-state";
import {
  exchangeTikTokAdsAuthCode,
  persistTikTokAdsTokens,
} from "@/server/services/tiktok-ads-oauth.service";

export const dynamic = "force-dynamic";

function settingsRedirect(tiktokAdsParam: string): NextResponse {
  const url = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("tiktok_ads", tiktokAdsParam);
  const response = NextResponse.redirect(url);
  response.cookies.set(TIKTOK_ADS_OAUTH_STATE_COOKIE, "", {
    ...tiktokAdsOAuthStateCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

/**
 * TikTok Marketing API advertiser OAuth callback.
 * GET /api/tiktok/oauth/callback/
 *
 * Register this exact Advertiser redirect URL in TikTok API for Business:
 *   https://radarcut.com/api/tiktok/oauth/callback/
 *
 * TikTok appends auth_code (and often a duplicate code), state, and id.
 */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    const login = new URL("/admin/login", env.NEXT_PUBLIC_SITE_URL);
    login.searchParams.set("from", "/admin/settings");
    return NextResponse.redirect(login);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  // Prefer auth_code; ignore the duplicate `code` param TikTok also sends.
  const authCode = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    console.error("[tiktok-ads-oauth] authorization denied", {
      error,
      errorDescription: errorDescription?.slice(0, 200),
    });
    return settingsRedirect(error === "access_denied" ? "access_denied" : "oauth_error");
  }

  if (!authCode) {
    return settingsRedirect("missing_code");
  }

  // When auth was started via /api/tiktok/oauth/auth we set a signed state cookie.
  // Portal-generated Advertiser authorization URLs may omit our cookie — admin
  // session is still required above.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(TIKTOK_ADS_OAUTH_STATE_COOKIE)?.value;
  if (expectedState) {
    if (
      !state ||
      !(await verifyTikTokAdsOAuthState(expectedState)) ||
      !statesMatch(expectedState, state)
    ) {
      return settingsRedirect("invalid_state");
    }
  }

  try {
    const token = await exchangeTikTokAdsAuthCode(authCode);
    await persistTikTokAdsTokens(token);
    return settingsRedirect("connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    console.error("[tiktok-ads-oauth] token exchange failed", {
      message: message.slice(0, 200),
    });
    return settingsRedirect("token_exchange_failed");
  }
}
