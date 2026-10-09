import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";
import {
  TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE,
  buildTikTokAccountAuthorizeUrl,
  getTikTokAccountRedirectUri,
  tiktokAccountOAuthConfigured,
} from "@/lib/tiktok-account";
import { safeEqualString } from "@/lib/token-crypto";

const STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

function stateSecret() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function createTikTokAccountOAuthState(): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  return new SignJWT({ nonce, purpose: "tiktok_account_oauth" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE_SECONDS}s`)
    .sign(stateSecret());
}

export async function verifyTikTokAccountOAuthState(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return payload.purpose === "tiktok_account_oauth" && typeof payload.nonce === "string";
  } catch {
    return false;
  }
}

export function tiktokAccountOAuthStateCookieOptions(maxAge = STATE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export {
  TIKTOK_ACCOUNT_OAUTH_STATE_COOKIE,
  buildTikTokAccountAuthorizeUrl,
  getTikTokAccountRedirectUri,
  tiktokAccountOAuthConfigured,
};

export function statesMatch(expected: string, received: string): boolean {
  return safeEqualString(expected, received);
}
