import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import {
  analyticsEventPayloadSchema,
  isBlockedAnalyticsPath,
} from "@/lib/analytics";
import { analyticsRateLimitKey, consumeAnalyticsRateLimit } from "@/lib/analytics-rate-limit";
import { parseBrowserName, parseOperatingSystem } from "@/lib/analytics-device";
import { visitorContextFromHeaders } from "@/lib/geo";
import { shouldOmitAnalytics } from "@/server/analytics-omit";
import { readRequestConsent } from "@/server/consent";
import {
  applyAnalyticsCookies,
  languageFromHeaders,
  newVisitorId,
  normalizeDeviceType,
  recordBeaconEvents,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/server/services/tracking.service";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = analyticsEventPayloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (isBlockedAnalyticsPath(parsed.data.path)) {
    return NextResponse.json({ ok: true });
  }

  const ua = userAgent(request);
  if (ua.isBot) {
    return NextResponse.json({ ok: true });
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const { allowAnalytics } = await readRequestConsent();

  if (!allowAnalytics) {
    return NextResponse.json({ ok: true });
  }

  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId();
  const geo = visitorContextFromHeaders(headerStore);
  if (await shouldOmitAnalytics(geo)) {
    return NextResponse.json({ ok: true });
  }
  if (!consumeAnalyticsRateLimit(analyticsRateLimitKey(visitorId, geo.ip))) {
    return NextResponse.json({ ok: true }, { status: 429 });
  }

  const session = await recordBeaconEvents(parsed.data, {
    visitorId,
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: parsed.data.path,
    referrer: parsed.data.referrer ?? headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: geo.ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    deviceType: normalizeDeviceType(ua.device.type),
    browser: parseBrowserName(ua.browser.name),
    operatingSystem: parseOperatingSystem(ua.os.name),
    language: languageFromHeaders(headerStore),
    source: parsed.data.source,
    medium: parsed.data.medium,
    campaign: parsed.data.campaign,
    term: parsed.data.term,
    content: parsed.data.content,
    metadata: parsed.data.metadata,
  });

  const response = NextResponse.json({ ok: true });
  applyAnalyticsCookies(response, session, true);
  return response;
}
