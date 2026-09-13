import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import {
  clientIpFromHeaders,
  countryFromHeaders,
  getActiveAffiliateUrl,
  newVisitorId,
  normalizeDeviceType,
  recordAffiliateClick,
  SESSION_COOKIE,
  trackingCookieOptions,
  VISITOR_COOKIE,
} from "@/server/services/tracking.service";

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function GET(request: Request, context: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await context.params;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const ua = userAgent(request);
  const home = new URL("/", siteOrigin());

  if (ua.isBot) {
    const destination = await getActiveAffiliateUrl(linkId);
    return NextResponse.redirect(destination ?? home);
  }

  const recorded = await recordAffiliateClick(linkId, {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: headerStore.get("referer") ?? undefined,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: clientIpFromHeaders(headerStore),
    country: countryFromHeaders(headerStore),
    deviceType: normalizeDeviceType(ua.device.type),
  });

  if (!recorded) {
    return NextResponse.redirect(home);
  }

  const response = NextResponse.redirect(recorded.destinationUrl);
  response.cookies.set(VISITOR_COOKIE, recorded.visitorId, trackingCookieOptions());
  response.cookies.set(SESSION_COOKIE, recorded.sessionId, trackingCookieOptions());
  return response;
}
