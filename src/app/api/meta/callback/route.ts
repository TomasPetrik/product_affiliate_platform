import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  META_OAUTH_STATE_COOKIE,
  metaOAuthStateCookieOptions,
  statesMatch,
  verifyMetaOAuthState,
} from "@/lib/meta-oauth-state";
import { completeMetaOAuth } from "@/server/services/meta-oauth.service";

export const dynamic = "force-dynamic";

function settingsRedirect(metaParam: string): NextResponse {
  const url = new URL("/admin/settings", env.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("meta", metaParam);
  const response = NextResponse.redirect(url);
  response.cookies.set(META_OAUTH_STATE_COOKIE, "", {
    ...metaOAuthStateCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

/**
 * Meta / Facebook Login OAuth callback.
 * GET /api/meta/callback
 *
 * Register this exact Redirect URI in Meta Developers → Facebook Login → Settings:
 *   https://radarcut.com/api/meta/callback
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
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    console.error("[meta-oauth] authorization denied", {
      error,
      errorReason,
      errorDescription: errorDescription?.slice(0, 200),
    });
    return settingsRedirect(error === "access_denied" ? "access_denied" : "oauth_error");
  }

  if (!code || !state) {
    return settingsRedirect("missing_code");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
  if (
    !expectedState ||
    !(await verifyMetaOAuthState(expectedState)) ||
    !statesMatch(expectedState, state)
  ) {
    return settingsRedirect("invalid_state");
  }

  try {
    await completeMetaOAuth(code);
    return settingsRedirect("connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    console.error("[meta-oauth] token exchange / page discovery failed", {
      message: message.slice(0, 200),
    });
    return settingsRedirect("token_exchange_failed");
  }
}
