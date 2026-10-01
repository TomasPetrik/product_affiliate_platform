import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";
import {
  META_OAUTH_STATE_COOKIE,
  buildMetaAuthorizeUrl,
  getMetaRedirectUri,
  metaOAuthConfigured,
} from "@/lib/meta";
import { safeEqualString } from "@/lib/token-crypto";

const STATE_MAX_AGE_SECONDS = 60 * 10;

function stateSecret() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function createMetaOAuthState(): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  return new SignJWT({ nonce, purpose: "meta_oauth" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE_SECONDS}s`)
    .sign(stateSecret());
}

export async function verifyMetaOAuthState(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return payload.purpose === "meta_oauth" && typeof payload.nonce === "string";
  } catch {
    return false;
  }
}

export function metaOAuthStateCookieOptions(maxAge = STATE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function statesMatch(expected: string, received: string): boolean {
  return safeEqualString(expected, received);
}

export {
  META_OAUTH_STATE_COOKIE,
  buildMetaAuthorizeUrl,
  getMetaRedirectUri,
  metaOAuthConfigured,
};
