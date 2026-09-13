import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";

/**
 * Signed, stateless admin session tokens (JWT via `jose`).
 *
 * This module has no dependency on `next/headers`, so it's safe to import
 * from `src/proxy.ts` (route protection) as well as from Server
 * Actions/Components (see `src/lib/auth.ts` for the cookie-aware wrappers).
 *
 * Deviation from the originally proposed architecture: the plan named
 * NextAuth/Auth.js for admin auth. At implementation time, Auth.js v5 (the
 * version with first-class App Router support) was still beta-tagged on
 * npm. Since this app only needs first-party email/password auth (no OAuth,
 * no adapters), a small, fully-owned session layer avoids pulling in a
 * pre-release dependency. Swapping to Auth.js later remains straightforward
 * — the `AdminUser` schema and password hashing (`src/lib/password.ts`) are
 * unaffected by that choice.
 */

export const SESSION_COOKIE_NAME = "findit_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  /** AdminUser.id */
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR";
}

function getSecretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role === "ADMIN" ? "ADMIN" : "EDITOR",
    };
  } catch {
    // Expired, malformed or tampered token.
    return null;
  }
}
