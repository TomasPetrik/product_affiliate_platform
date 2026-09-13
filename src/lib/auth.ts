import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

/** Sets the signed session cookie after a successful login. Server Action/Route Handler only. */
export async function createAdminSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clears the session cookie on sign-out. */
export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Reads and verifies the current admin session, if any. Safe to call anywhere on the server. */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Use inside Server Actions / Server Components that must be authenticated.
 * `src/proxy.ts` already blocks unauthenticated requests to `/admin/*`, but
 * Server Actions are called directly over POST and must not rely on Proxy
 * alone (see Next.js's own guidance on this) — so every mutating action
 * calls this too.
 */
export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getAdminSession();

  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  return session;
}

/** Use when an action is restricted to the ADMIN role (not EDITOR). */
export async function requireAdminRole(): Promise<SessionPayload> {
  const session = await requireAdminSession();

  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return session;
}
