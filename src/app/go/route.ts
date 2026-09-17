import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import { env } from "@/lib/env";
import { visitorContextFromHeaders } from "@/lib/geo";
import { shouldOmitAnalytics } from "@/server/analytics-omit";
import { readRequestConsent } from "@/server/consent";
import {
  applyAnalyticsCookies,
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
  const geo = visitorContextFromHeaders(headerStore);
  if (await shouldOmitAnalytics(geo)) {
    return NextResponse.redirect(destination);
  }

  const recorded = await recordOutboundClick(destination.toString(), {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: headerStore.get("referer") ?? undefined,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: geo.ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    deviceType: normalizeDeviceType(ua.device.type),
  });

  const response = NextResponse.redirect(recorded?.destinationUrl ?? destination);
  if (recorded) {
    applyAnalyticsCookies(response, recorded, allowAnalytics);
  }
  return response;
}
