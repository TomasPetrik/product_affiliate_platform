import { cookies, headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

import { collectCampaignParams } from "@/lib/analytics";
import { env } from "@/lib/env";
import {
  marketplaceFromRequest,
  resolvePublishedAffiliateTarget,
  sanitizeAffiliateDestination,
} from "@/server/services/affiliate-redirect.service";
import { readRequestConsent } from "@/server/consent";
import {
  applyAnalyticsCookies,
  clientIpFromHeaders,
  countryFromHeaders,
  newVisitorId,
  normalizeDeviceType,
  recordAffiliateClick,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/server/services/tracking.service";

export const dynamic = "force-dynamic";

function siteUrl(path = "/"): URL {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL);
}

function noStoreRedirect(destination: string | URL, status = 302) {
  const response = NextResponse.redirect(destination, status);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/**
 * Public affiliate hop.
 *
 * `/go/magnetic-car-phone-holder` → validate published product →
 * pick the active (optionally marketplace-specific) affiliate link →
 * record `affiliate_click` → 302 to the stored marketplace URL.
 *
 * Destination is never taken from the query string.
 */
export async function GET(request: Request, context: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await context.params;
  const requestUrl = new URL(request.url);
  const marketplaceCode = marketplaceFromRequest(requestUrl.searchParams);
  const home = siteUrl("/");

  const target = await resolvePublishedAffiliateTarget(productSlug, marketplaceCode);

  if (!target) {
    return noStoreRedirect(home);
  }

  const ua = userAgent(request);
  if (ua.isBot) {
    return noStoreRedirect(target.destinationUrl);
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const campaign = collectCampaignParams(requestUrl.searchParams);
  const { allowAnalytics } = await readRequestConsent();

  const recorded = await recordAffiliateClick(target.linkId, {
    visitorId: cookieStore.get(VISITOR_COOKIE)?.value || newVisitorId(),
    sessionId: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    path: `/go/${target.productSlug}`,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ip: clientIpFromHeaders(headerStore),
    country: countryFromHeaders(headerStore),
    deviceType: normalizeDeviceType(ua.device.type),
    source: campaign.source,
    medium: campaign.medium,
    campaign: campaign.campaign,
    term: campaign.term,
    content: campaign.content,
  });

  const destination = sanitizeAffiliateDestination(recorded?.destinationUrl ?? "");
  if (!recorded || !destination) {
    return noStoreRedirect(home);
  }

  const response = noStoreRedirect(destination);
  applyAnalyticsCookies(response, recorded, allowAnalytics);
  return response;
}
