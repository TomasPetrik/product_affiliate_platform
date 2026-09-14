import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  consentCookieOptions,
  serializeConsent,
  type ConsentState,
} from "@/lib/consent";
import { clearAnalyticsCookies } from "@/server/services/tracking.service";

const payloadSchema = z.object({
  analytics: z.boolean(),
  doNotSell: z.boolean(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const consent: ConsentState = {
    v: CONSENT_VERSION,
    analytics: parsed.data.analytics,
    doNotSell: parsed.data.doNotSell,
  };

  const response = NextResponse.json({ ok: true, consent });
  response.cookies.set(CONSENT_COOKIE_NAME, serializeConsent(consent), consentCookieOptions());

  if (!consent.analytics) {
    clearAnalyticsCookies(response);
  }

  return response;
}
