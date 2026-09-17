import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import { collectCampaignParams } from "@/lib/analytics";
import { parseBrowserName, parseOperatingSystem } from "@/lib/analytics-device";
import { env } from "@/lib/env";
import { visitorContextFromHeaders } from "@/lib/geo";
import { shouldOmitAnalytics } from "@/server/analytics-omit";
import { readRequestConsent } from "@/server/consent";
import { sanitizeAffiliateDestination } from "@/server/services/affiliate-redirect.service";
import {
  applyAnalyticsCookies,
  languageFromHeaders,
  newVisitorId,
  normalizeDeviceType,
  recordAffiliateClick,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/server/services/tracking.service";

export function siteUrl(path = "/"): URL {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL);
}

export function noStoreRedirect(destination: string | URL, status = 302) {
  const response = NextResponse.redirect(destination, status);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function redirectAfterAffiliateClick(input: {
  request: Request;
  linkId: string;
  path: string;
  destinationUrl: string;
}) {
  const ua = userAgent(input.request);
  if (ua.isBot) {
    return noStoreRedirect(input.destinationUrl);
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const campaign = collectCampaignParams(new URL(input.request.url).searchParams);
  const { allowAnalytics } = await readRequestConsent();
  const geo = visitorContextFromHeaders(headerStore);
  if (await shouldOmitAnalytics(geo)) {
    return noStoreRedirect(input.destinationUrl);
  }

  const recorded = await recordAffiliateClick(input.linkId, {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: input.path,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: geo.ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    deviceType: normalizeDeviceType(ua.device.type),
    browser: parseBrowserName(ua.browser.name),
    operatingSystem: parseOperatingSystem(ua.os.name),
    language: languageFromHeaders(headerStore),
    source: campaign.source,
    medium: campaign.medium,
    campaign: campaign.campaign,
    term: campaign.term,
    content: campaign.content,
  });

  const destination = sanitizeAffiliateDestination(recorded?.destinationUrl ?? "");
  if (!recorded || !destination) {
    return noStoreRedirect(siteUrl("/"));
  }

  const response = noStoreRedirect(destination);
  applyAnalyticsCookies(response, recorded, allowAnalytics);
  return response;
}
