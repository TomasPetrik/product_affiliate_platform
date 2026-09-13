import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import { env } from "@/lib/env";
import {
  clientIpFromHeaders,
  countryFromHeaders,
  newVisitorId,
  normalizeDeviceType,
  parseOutboundUrl,
  recordOutboundClick,
  SESSION_COOKIE,
  trackingCookieOptions,
  VISITOR_COOKIE,
} from "@/server/services/tracking.service";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const destination = parseOutboundUrl(requestUrl.searchParams.get("u"));
  const home = new URL("/", env.NEXT_PUBLIC_SITE_URL);

  if (!destination) {
    return NextResponse.redirect(home);
  }

  const ua = userAgent(request);
  if (ua.isBot) {
    return NextResponse.redirect(destination);
  }

  const cookieStore = await cookies();
  const headerStore = await headers();

  const recorded = await recordOutboundClick(destination.toString(), {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: headerStore.get("referer") ?? undefined,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: clientIpFromHeaders(headerStore),
    country: countryFromHeaders(headerStore),
    deviceType: normalizeDeviceType(ua.device.type),
  });

  const response = NextResponse.redirect(recorded?.destinationUrl ?? destination);
  if (recorded) {
    response.cookies.set(VISITOR_COOKIE, recorded.visitorId, trackingCookieOptions());
    response.cookies.set(SESSION_COOKIE, recorded.sessionId, trackingCookieOptions());
  }
  return response;
}
