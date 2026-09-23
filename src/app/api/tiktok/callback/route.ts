import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  statesMatch,
  tiktokOAuthStateCookieOptions,
  verifyTikTokOAuthState,
} from "@/lib/tiktok-oauth-state";
import {
  exchangeAuthorizationCode,
  persistTikTokTokens,
} from "@/server/services/tiktok-oauth.service";

export const dynamic = "force-dynamic";

function settingsRedirect(tiktokParam: string): NextResponse {
  const url = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("tiktok", tiktokParam);
  const response = NextResponse.redirect(url);
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, "", {
    ...tiktokOAuthStateCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

/**
 * TikTok Login Kit OAuth callback.
 * GET /api/tiktok/callback
 *
 * Register this exact Redirect URI in TikTok Developer Portal:
 *   https://radarcut.com/api/tiktok/callback
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
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    const safe =
      error === "access_denied"
        ? "access_denied"
        : error === "invalid_scope"
          ? "invalid_scope"
          : "oauth_error";
    console.error("[tiktok-oauth] authorization denied", {
      error,
      errorDescription: errorDescription?.slice(0, 200),
    });
    return settingsRedirect(safe);
  }

  if (!code || !state) {
    return settingsRedirect("missing_code");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(TIKTOK_OAUTH_STATE_COOKIE)?.value;
  if (
    !expectedState ||
    !(await verifyTikTokOAuthState(expectedState)) ||
    !statesMatch(expectedState, state)
  ) {
    return settingsRedirect("invalid_state");
  }

  try {
    const token = await exchangeAuthorizationCode(code);
    await persistTikTokTokens(token);
    return settingsRedirect("connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    console.error("[tiktok-oauth] token exchange failed", {
      message: message.slice(0, 200),
    });
    return settingsRedirect("token_exchange_failed");
  }
}
