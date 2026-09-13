import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { newVisitorId, recordAffiliateClick, SESSION_COOKIE, TRACKING_COOKIE_MAX_AGE, VISITOR_COOKIE } from "@/server/services/tracking.service";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRACKING_COOKIE_MAX_AGE,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await context.params;
  const cookieStore = await cookies();
  const headerStore = await headers();

  const recorded = await recordAffiliateClick(linkId, {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: headerStore.get("referer") ?? undefined,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  if (!recorded) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const response = NextResponse.redirect(recorded.destinationUrl);
  response.cookies.set(VISITOR_COOKIE, recorded.visitorId, cookieOptions());
  response.cookies.set(SESSION_COOKIE, recorded.sessionId, cookieOptions());
  return response;
}
