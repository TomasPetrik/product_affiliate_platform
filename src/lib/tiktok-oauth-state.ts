import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  buildTikTokAuthorizeUrl,
  getTikTokRedirectUri,
  tiktokOAuthConfigured,
} from "@/lib/tiktok";
import { safeEqualString } from "@/lib/token-crypto";

const STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

function stateSecret() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function createTikTokOAuthState(): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  return new SignJWT({ nonce, purpose: "tiktok_oauth" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE_SECONDS}s`)
    .sign(stateSecret());
}

export async function verifyTikTokOAuthState(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return payload.purpose === "tiktok_oauth" && typeof payload.nonce === "string";
  } catch {
    return false;
  }
}

export function tiktokOAuthStateCookieOptions(maxAge = STATE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { TIKTOK_OAUTH_STATE_COOKIE, buildTikTokAuthorizeUrl, getTikTokRedirectUri, tiktokOAuthConfigured };

export function statesMatch(expected: string, received: string): boolean {
  return safeEqualString(expected, received);
}
