import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { newVisitorId, recordProductView, SESSION_COOKIE, TRACKING_COOKIE_MAX_AGE, touchTrafficSession, VISITOR_COOKIE } from "@/server/services/tracking.service";

const payloadSchema = z.object({
  path: z.string().max(500).optional(),
  referrer: z.string().max(1000).optional().nullable(),
  productId: z.string().optional(),
  source: z.string().max(200).optional().nullable(),
  medium: z.string().max(200).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  term: z.string().max(200).optional().nullable(),
  content: z.string().max(200).optional().nullable(),
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRACKING_COOKIE_MAX_AGE,
  };
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const context = {
    visitorId,
    sessionId,
    path: parsed.data.path,
    referrer: parsed.data.referrer ?? headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    source: parsed.data.source,
    medium: parsed.data.medium,
    campaign: parsed.data.campaign,
    term: parsed.data.term,
    content: parsed.data.content,
  };

  const session = parsed.data.productId
    ? await recordProductView(parsed.data.productId, context).then(async (view) => {
        if (view?.sessionId) {
          return { visitorId, sessionId: view.sessionId };
        }
        return touchTrafficSession(context);
      })
    : await touchTrafficSession(context);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(VISITOR_COOKIE, session.visitorId, cookieOptions());
  response.cookies.set(SESSION_COOKIE, session.sessionId, cookieOptions());
  return response;
}
