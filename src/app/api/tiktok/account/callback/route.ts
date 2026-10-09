import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE,
  statesMatch,
  tiktokAccountOAuthStateCookieOptions,
  verifyTikTokAccountOAuthState,
} from "@/lib/tiktok-account-oauth-state";
import {
  exchangeTikTokAccountAuthCode,
  persistTikTokAccountTokens,
} from "@/server/services/tiktok-account-oauth.service";

export const dynamic = "force-dynamic";

function settingsRedirect(tiktokAccountParam: string): NextResponse {
  const url = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("tiktok_account", tiktokAccountParam);
  const response = NextResponse.redirect(url);
  response.cookies.set(TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE, "", {
    ...tiktokAccountOAuthStateCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

/**
 * TikTok account holder (Business Account) OAuth callback.
 * GET /api/tiktok/account/callback/
 *
 * Register this exact URL in TikTok API for Business →
 * "TikTok account holder redirect URL":
 *   https://radarcut.com/api/tiktok/account/callback/
 *
 * TikTok redirects with code=… (used as auth_code for /tt_user/oauth2/token/).
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
  // Account-holder flow typically sends `code`; some variants also send auth_code.
  const authCode = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    console.error("[tiktok-account-oauth] authorization denied", {
      error,
      errorDescription: errorDescription?.slice(0, 200),
    });
    return settingsRedirect(error === "access_denied" ? "access_denied" : "oauth_error");
  }

  if (!authCode) {
    return settingsRedirect("missing_code");
  }

  // When auth was started via /api/tiktok/account/auth we set a signed state cookie.
  // Portal-generated account holder authorization URLs may omit our cookie — admin
  // session is still required above.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE)?.value;
  if (expectedState) {
    if (
      !state ||
      !(await verifyTikTokAccountOAuthState(expectedState)) ||
      !statesMatch(expectedState, state)
    ) {
      return settingsRedirect("invalid_state");
    }
  }

  try {
    const token = await exchangeTikTokAccountAuthCode(authCode);
    await persistTikTokAccountTokens(token);
    return settingsRedirect("connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    console.error("[tiktok-account-oauth] token exchange failed", {
      message: message.slice(0, 200),
    });
    return settingsRedirect("token_exchange_failed");
  }
}
