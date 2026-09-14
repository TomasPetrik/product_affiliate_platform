import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import { env } from "@/lib/env";
import { readRequestConsent } from "@/server/consent";
import {
  applyAnalyticsCookies,
  clientIpFromHeaders,
  countryFromHeaders,
  newVisitorId,
  normalizeDeviceType,
  parseOutboundUrl,
  recordOutboundClick,
  SESSION_COOKIE,
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
  const { allowAnalytics } = await readRequestConsent();

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
    applyAnalyticsCookies(response, recorded, allowAnalytics);
  }
  return response;
}
