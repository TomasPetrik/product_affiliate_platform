/**
 * First-party privacy consent for RadarCut.
 *
 * This is a Consent Management UI, not an IAB TCF vendor list. The public site
 * does not run a third-party ad network; optional cookies are our own analytics
 * identifiers. Region handling:
 *
 * - EU/EEA/UK (and other non-US countries): ePrivacy + GDPR-style opt-in.
 *   Analytics cookies stay off until the visitor accepts or confirms choices.
 * - US: CCPA/CPRA-style opt-out. Analytics may run until they reject, and we
 *   honor Global Privacy Control (GPC) as an opt-out of sale/sharing and of
 *   analytics cookies.
 */

export const CONSENT_COOKIE_NAME = "findit_consent";
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
export const CONSENT_CHANGE_EVENT = "findit:consent";
export const OPEN_PRIVACY_SETTINGS_EVENT = "findit:privacy-settings";

export type ConsentRegion = "eu" | "us";

export interface ConsentState {
  v: number;
  analytics: boolean;
  doNotSell: boolean;
}

/** ISO 3166-1 alpha-2 codes that get GDPR / ePrivacy / UK GDPR opt-in treatment. */
const OPT_IN_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
  "CH",
]);

export function consentCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONSENT_MAX_AGE,
  };
}

export function serializeConsent(state: ConsentState): string {
  return `${CONSENT_VERSION}.${state.analytics ? "1" : "0"}.${state.doNotSell ? "1" : "0"}`;
}

export function parseConsentCookie(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;

  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    value = raw;
  }

  const [version, analytics, doNotSell] = value.split(/[.:]/);
  if (version !== String(CONSENT_VERSION)) return null;
  if (analytics !== "0" && analytics !== "1") return null;
  if (doNotSell !== "0" && doNotSell !== "1") return null;

  return {
    v: CONSENT_VERSION,
    analytics: analytics === "1",
    doNotSell: doNotSell === "1",
  };
}

export function consentRegionFromCountry(country: string | null | undefined): ConsentRegion {
  if (country === "US") return "us";
  if (!country) return "eu";
  if (OPT_IN_COUNTRIES.has(country)) return "eu";
  // Unknown or other countries: require opt-in rather than setting analytics by default.
  return "eu";
}

export function headerHasGpc(value: string | null | undefined): boolean {
  return value === "1";
}

export function clientHasGpc(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
}

export function defaultConsent(region: ConsentRegion, gpc: boolean): ConsentState {
  if (region === "us" && !gpc) {
    return { v: CONSENT_VERSION, analytics: true, doNotSell: false };
  }

  return { v: CONSENT_VERSION, analytics: false, doNotSell: true };
}

export function acceptAllConsent(): ConsentState {
  return { v: CONSENT_VERSION, analytics: true, doNotSell: false };
}

export function rejectNonEssentialConsent(): ConsentState {
  return { v: CONSENT_VERSION, analytics: false, doNotSell: true };
}

export function allowsAnalytics(
  consent: ConsentState | null,
  region: ConsentRegion,
  gpc: boolean,
): boolean {
  if (consent) return consent.analytics;
  return defaultConsent(region, gpc).analytics;
}

export function readConsentFromDocumentCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;

  const prefix = `${CONSENT_COOKIE_NAME}=`;
  const match = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!match) return null;

  return parseConsentCookie(decodeURIComponent(match.slice(prefix.length)));
}
