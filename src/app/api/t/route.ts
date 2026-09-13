import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";
import { z } from "zod";

import {
  ANALYTICS_EVENT_NAMES,
  clientIpFromHeaders,
  countryFromHeaders,
  newVisitorId,
  normalizeDeviceType,
  recordBeaconEvents,
  SESSION_COOKIE,
  trackingCookieOptions,
  VISITOR_COOKIE,
} from "@/server/services/tracking.service";

const payloadSchema = z.object({
  path: z.string().max(500).optional(),
  search: z.string().max(200).optional().nullable(),
  referrer: z.string().max(1000).optional().nullable(),
  productId: z.string().max(64).optional().nullable(),
  categoryId: z.string().max(64).optional().nullable(),
  destinationUrl: z.string().max(2000).optional().nullable(),
  affiliateLinkId: z.string().max(64).optional().nullable(),
  events: z.array(z.enum(ANALYTICS_EVENT_NAMES)).max(6).optional(),
  source: z.string().max(200).optional().nullable(),
  medium: z.string().max(200).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  term: z.string().max(200).optional().nullable(),
  content: z.string().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = parsed.data.path ?? "";
  if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/out") || path.startsWith("/go")) {
    return NextResponse.json({ ok: true });
  }

  const ua = userAgent(request);
  if (ua.isBot) {
    return NextResponse.json({ ok: true });
  }

  const cookieStore = await cookies();
  const headerStore = await headers();

  const session = await recordBeaconEvents(parsed.data, {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: parsed.data.path,
    referrer: parsed.data.referrer ?? headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: clientIpFromHeaders(headerStore),
    country: countryFromHeaders(headerStore),
    deviceType: normalizeDeviceType(ua.device.type),
    source: parsed.data.source,
    medium: parsed.data.medium,
    campaign: parsed.data.campaign,
    term: parsed.data.term,
    content: parsed.data.content,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(VISITOR_COOKIE, session.visitorId, trackingCookieOptions());
  response.cookies.set(SESSION_COOKIE, session.sessionId, trackingCookieOptions());
  return response;
}
