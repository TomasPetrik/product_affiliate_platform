import { cookies, headers } from "next/headers";

import {
  allowsAnalytics,
  CONSENT_COOKIE_NAME,
  consentRegionFromCountry,
  headerHasGpc,
  parseConsentCookie,
  type ConsentRegion,
  type ConsentState,
} from "@/lib/consent";
import { countryFromHeaders } from "@/server/services/tracking.service";

export interface RequestConsent {
  region: ConsentRegion;
  consent: ConsentState | null;
  gpc: boolean;
  allowAnalytics: boolean;
}

export async function readRequestConsent(): Promise<RequestConsent> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const region = consentRegionFromCountry(countryFromHeaders(headerStore));
  const gpc = headerHasGpc(headerStore.get("sec-gpc"));
  const consent = parseConsentCookie(cookieStore.get(CONSENT_COOKIE_NAME)?.value);

  return {
    region,
    consent,
    gpc,
    allowAnalytics: allowsAnalytics(consent, region, gpc),
  };
}
