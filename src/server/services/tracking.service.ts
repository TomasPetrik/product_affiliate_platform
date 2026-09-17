import { createHash, randomUUID } from "crypto";

import type { AnalyticsEventType, DeviceType, Prisma } from "@/generated/prisma/client";
import {
  ANALYTICS_EVENT_NAMES,
  sanitizeAnalyticsMetadata,
  type AnalyticsEventName,
  type ParsedAnalyticsPayload,
} from "@/lib/analytics";
import { cleanCampaignParams, hasCampaignParams, mergeAttribution } from "@/lib/analytics-attribution";
import { normalizeDeviceType, parseBrowserName, parseOperatingSystem } from "@/lib/analytics-device";
import { normalizeTrafficSource } from "@/lib/analytics-source";
import { env } from "@/lib/env";
import { clientIpFromHeaders, countryFromHeaders, languageFromHeaders, regionFromHeaders } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

export { ANALYTICS_EVENT_NAMES, type AnalyticsEventName };
export { clientIpFromHeaders, countryFromHeaders, languageFromHeaders, regionFromHeaders };
export { normalizeDeviceType };

export const VISITOR_COOKIE = "findit_vid";
export const SESSION_COOKIE = "findit_sid";
export const TRACKING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SESSION_IDLE_MS = 30 * 60 * 1000;

const DEDUPE_WINDOW_MS: Record<AnalyticsEventType, number> = {
  PAGE_VIEW: 10_000,
  PRODUCT_VIEW: 30 * 60 * 1000,
  CATEGORY_VIEW: 30 * 60 * 1000,
  SEARCH: 15_000,
  SEARCH_RESULT_CLICK: 10_000,
  NO_SEARCH_RESULTS: 15_000,
  RETAILER_OFFER_VIEW: 30 * 60 * 1000,
  AFFILIATE_CLICK: 10_000,
  OUTBOUND_CLICK: 10_000,
  SHARE: 10_000,
  AFFILIATE_CONVERSION: 60_000,
};

const PRODUCT_PATH = /^\/products\/([^/?#]+)\/?$/;
const CATEGORY_PATH = /^\/categories\/([^/?#]+)\/?$/;

export interface TrackingContext {
  visitorId: string;
  sessionId: string | null;
  path?: string;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  deviceType?: DeviceType | null;
  browser?: string | null;
  operatingSystem?: string | null;
  language?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
}

export interface ResolvedTrafficSession {
  visitorId: string;
  sessionId: string;
  landingPath: string | null;
  referrer: string | null;
  deviceType: DeviceType | null;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  operatingSystem: string | null;
  language: string | null;
  firstSource: string | null;
  firstMedium: string | null;
  firstCampaign: string | null;
  firstContent: string | null;
  firstTerm: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
}

export function trackingCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRACKING_COOKIE_MAX_AGE,
  };
}

export function applyAnalyticsCookies(
  response: { cookies: { set(name: string, value: string, options: ReturnType<typeof trackingCookieOptions>): unknown } },
  session: { visitorId: string; sessionId: string },
  allowed: boolean,
) {
  if (!allowed) return;

  response.cookies.set(VISITOR_COOKIE, session.visitorId, trackingCookieOptions());
  response.cookies.set(SESSION_COOKIE, session.sessionId, trackingCookieOptions());
}

export function clearAnalyticsCookies(response: {
  cookies: { set(name: string, value: string, options: ReturnType<typeof trackingCookieOptions>): unknown };
}) {
  const expired = { ...trackingCookieOptions(), maxAge: 0 };
  response.cookies.set(VISITOR_COOKIE, "", expired);
  response.cookies.set(SESSION_COOKIE, "", expired);
}

export function newVisitorId(): string {
  return randomUUID();
}

export function parseOutboundUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${ip}:${env.AUTH_SECRET}`).digest("hex");
}

export async function purgeAnalyticsForIps(
  ips: string[],
): Promise<{ sessions: number; events: number; clicks: number; views: number }> {
  const hashes = [...new Set(ips.map((ip) => hashIp(ip)).filter((hash): hash is string => Boolean(hash)))];
  if (hashes.length === 0) {
    return { sessions: 0, events: 0, clicks: 0, views: 0 };
  }

  const sessions = await prisma.trafficSession.findMany({
    where: { ipHash: { in: hashes } },
    select: { id: true, anonymousId: true },
  });
  const sessionIds = sessions.map((session) => session.id);
  const visitorIds = [...new Set(sessions.map((session) => session.anonymousId))];
  const eventWhere =
    sessionIds.length === 0 && visitorIds.length === 0
      ? null
      : {
          OR: [
            ...(sessionIds.length > 0 ? [{ sessionId: { in: sessionIds } }] : []),
            ...(visitorIds.length > 0 ? [{ visitorId: { in: visitorIds } }] : []),
          ],
        };

  const [events, views, clicks] = await prisma.$transaction([
    eventWhere ? prisma.analyticsEvent.deleteMany({ where: eventWhere }) : prisma.analyticsEvent.deleteMany({ where: { id: { in: [] } } }),
    prisma.productView.deleteMany({ where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { id: { in: [] } } }),
    prisma.affiliateClick.deleteMany({ where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { id: { in: [] } } }),
  ]);

  if (sessionIds.length > 0) {
    await prisma.uTMEvent.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.trafficSession.deleteMany({ where: { id: { in: sessionIds } } });
  }

  return {
    sessions: sessionIds.length,
    events: events.count,
    clicks: clicks.count,
    views: views.count,
  };
}

function clean(value: string | null | undefined, max = 500): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeSearchQuery(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, 200) : null;
}

function dedupeKey(type: AnalyticsEventType, parts: Array<string | null | undefined>, at = Date.now()): string {
  const windowMs = DEDUPE_WINDOW_MS[type];
  const bucket = Math.floor(at / windowMs);
  const raw = [type, ...parts.map((part) => part ?? ""), String(bucket)].join("|");

  if (raw.length <= 180) return raw;
  return createHash("sha256").update(raw).digest("hex");
}

export async function touchTrafficSession(context: TrackingContext): Promise<ResolvedTrafficSession> {
  const visitorId = context.visitorId || newVisitorId();
  const now = new Date();
  const deviceType = context.deviceType ?? null;
  const country = clean(context.country, 2);
  const region = clean(context.region, 64);
  const city = clean(context.city, 64);
  const incoming = cleanCampaignParams({
    source: context.source,
    medium: context.medium,
    campaign: context.campaign,
    content: context.content,
    term: context.term,
  });

  const existing = context.sessionId
    ? await prisma.trafficSession.findUnique({
        where: { id: context.sessionId },
        include: { utmEvents: { orderBy: { createdAt: "asc" }, take: 1 } },
      })
    : null;

  const sessionIsFresh = existing ? now.getTime() - existing.lastSeenAt.getTime() < SESSION_IDLE_MS : false;

  const existingFirst = cleanCampaignParams({
    source: existing?.firstSource ?? existing?.utmEvents[0]?.source,
    medium: existing?.firstMedium ?? existing?.utmEvents[0]?.medium,
    campaign: existing?.firstCampaign ?? existing?.utmEvents[0]?.campaign,
    content: existing?.firstContent ?? existing?.utmEvents[0]?.content,
    term: existing?.firstTerm ?? existing?.utmEvents[0]?.term,
  });
  const existingLast = cleanCampaignParams({
    source: existing?.lastSource ?? existingFirst.source,
    medium: existing?.lastMedium ?? existingFirst.medium,
    campaign: existing?.lastCampaign ?? existingFirst.campaign,
    content: existing?.lastContent ?? existingFirst.content,
    term: existing?.lastTerm ?? existingFirst.term,
  });
  const attribution = mergeAttribution(existingFirst, existingLast, incoming);

  const session = existing && sessionIsFresh
    ? await prisma.trafficSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          referrer: existing.referrer ?? clean(context.referrer),
          userAgent: existing.userAgent ?? clean(context.userAgent),
          landingPath: existing.landingPath ?? clean(context.path),
          deviceType: existing.deviceType ?? deviceType,
          country: existing.country ?? country,
          region: existing.region ?? region,
          city: existing.city ?? city,
          firstSource: existing.firstSource ?? attribution.first.source,
          firstMedium: existing.firstMedium ?? attribution.first.medium,
          firstCampaign: existing.firstCampaign ?? attribution.first.campaign,
          firstContent: existing.firstContent ?? attribution.first.content,
          firstTerm: existing.firstTerm ?? attribution.first.term,
          lastSource: attribution.last.source,
          lastMedium: attribution.last.medium,
          lastCampaign: attribution.last.campaign,
          lastContent: attribution.last.content,
          lastTerm: attribution.last.term,
        },
      })
    : await prisma.trafficSession.create({
        data: {
          anonymousId: visitorId,
          landingPath: clean(context.path),
          referrer: clean(context.referrer),
          userAgent: clean(context.userAgent),
          ipHash: hashIp(context.ip),
          deviceType,
          country,
          region,
          city,
          firstSource: attribution.first.source,
          firstMedium: attribution.first.medium,
          firstCampaign: attribution.first.campaign,
          firstContent: attribution.first.content,
          firstTerm: attribution.first.term,
          lastSource: attribution.last.source,
          lastMedium: attribution.last.medium,
          lastCampaign: attribution.last.campaign,
          lastContent: attribution.last.content,
          lastTerm: attribution.last.term,
          startedAt: now,
          lastSeenAt: now,
        },
      });

  if (hasCampaignParams(incoming) && !(existing && sessionIsFresh && existingFirst.source)) {
    const alreadyHasFirstUtm = existing && sessionIsFresh
      ? Boolean(existing.utmEvents[0])
      : false;
    if (!alreadyHasFirstUtm) {
      await prisma.uTMEvent.create({
        data: {
          sessionId: session.id,
          source: attribution.first.source,
          medium: attribution.first.medium,
          campaign: attribution.first.campaign,
          term: attribution.first.term,
          content: attribution.first.content,
          landingPath: clean(context.path),
          referrer: clean(context.referrer),
        },
      });
    }
  }

  return {
    visitorId,
    sessionId: session.id,
    landingPath: session.landingPath,
    referrer: session.referrer,
    deviceType: session.deviceType,
    country: session.country,
    region: session.region,
    city: session.city,
    browser: parseBrowserName(context.browser),
    operatingSystem: parseOperatingSystem(context.operatingSystem),
    language: clean(context.language, 16),
    firstSource: session.firstSource,
    firstMedium: session.firstMedium,
    firstCampaign: session.firstCampaign,
    firstContent: session.firstContent,
    firstTerm: session.firstTerm,
    source: session.lastSource,
    medium: session.lastMedium,
    campaign: session.lastCampaign,
    term: session.lastTerm,
    content: session.lastContent,
  };
}

async function insertAnalyticsEvent(data: Prisma.AnalyticsEventCreateManyInput): Promise<boolean> {
  const result = await prisma.analyticsEvent.createMany({
    data: [data],
    skipDuplicates: true,
  });
  return result.count > 0;
}

function eventBase(session: ResolvedTrafficSession, context: TrackingContext): Omit<Prisma.AnalyticsEventCreateManyInput, "type" | "dedupeKey"> {
  const last = {
    source: clean(context.source, 200) ?? session.source,
    medium: clean(context.medium, 200) ?? session.medium,
    campaign: clean(context.campaign, 200) ?? session.campaign,
    term: clean(context.term, 200) ?? session.term,
    content: clean(context.content, 200) ?? session.content,
  };
  const referrer = clean(context.referrer) ?? session.referrer;

  return {
    visitorId: session.visitorId,
    sessionId: session.sessionId,
    path: clean(context.path),
    landingPath: session.landingPath,
    referrer,
    utmSource: last.source,
    utmMedium: last.medium,
    utmCampaign: last.campaign,
    utmContent: last.content,
    utmTerm: last.term,
    firstUtmSource: session.firstSource,
    firstUtmMedium: session.firstMedium,
    firstUtmCampaign: session.firstCampaign,
    firstUtmContent: session.firstContent,
    firstUtmTerm: session.firstTerm,
    sourceNormalized: normalizeTrafficSource(last.source, referrer),
    deviceType: session.deviceType,
    browser: session.browser,
    operatingSystem: session.operatingSystem,
    language: session.language,
    country: session.country,
    region: session.region,
    city: session.city,
    metadata: sanitizeAnalyticsMetadata(context.metadata) ?? undefined,
  };
}

export async function recordPageView(context: TrackingContext, session?: ResolvedTrafficSession) {
  const resolved = session ?? (await touchTrafficSession(context));
  const path = clean(context.path) ?? "/";

  await insertAnalyticsEvent({
    type: "PAGE_VIEW",
    ...eventBase(resolved, context),
    dedupeKey: dedupeKey("PAGE_VIEW", [resolved.visitorId, resolved.sessionId, path]),
  });

  return resolved;
}

export async function recordProductView(productId: string, context: TrackingContext, session?: ResolvedTrafficSession) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, categoryId: true },
  });
  if (!product) return null;

  const resolved = session ?? (await touchTrafficSession(context));
  const inserted = await insertAnalyticsEvent({
    type: "PRODUCT_VIEW",
    ...eventBase(resolved, context),
    productId: product.id,
    categoryId: product.categoryId,
    dedupeKey: dedupeKey("PRODUCT_VIEW", [resolved.sessionId, product.id]),
  });

  if (inserted) {
    await prisma.productView.create({
      data: {
        productId: product.id,
        sessionId: resolved.sessionId,
        path: clean(context.path) ?? `/products`,
      },
    });
  }

  return resolved;
}

export async function recordCategoryView(categoryId: string, context: TrackingContext, session?: ResolvedTrafficSession) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return null;

  const resolved = session ?? (await touchTrafficSession(context));
  await insertAnalyticsEvent({
    type: "CATEGORY_VIEW",
    ...eventBase(resolved, context),
    categoryId: category.id,
    dedupeKey: dedupeKey("CATEGORY_VIEW", [resolved.sessionId, category.id]),
  });

  return resolved;
}

export async function recordSearch(
  query: string,
  context: TrackingContext,
  session?: ResolvedTrafficSession,
  resultCount?: number | null,
) {
  const searchQuery = normalizeSearchQuery(query);
  if (!searchQuery) return null;

  const resolved = session ?? (await touchTrafficSession(context));
  const count = typeof resultCount === "number" && Number.isFinite(resultCount) ? Math.max(0, Math.min(10_000, resultCount)) : null;

  await insertAnalyticsEvent({
    type: "SEARCH",
    ...eventBase(resolved, context),
    searchQuery,
    resultCount: count,
    dedupeKey: dedupeKey("SEARCH", [resolved.sessionId, searchQuery.toLowerCase()]),
  });

  if (count === 0) {
    await insertAnalyticsEvent({
      type: "NO_SEARCH_RESULTS",
      ...eventBase(resolved, context),
      searchQuery,
      resultCount: 0,
      dedupeKey: dedupeKey("NO_SEARCH_RESULTS", [resolved.sessionId, searchQuery.toLowerCase()]),
    });
  }

  return resolved;
}

export async function recordSearchResultClick(productId: string, query: string, context: TrackingContext, session?: ResolvedTrafficSession) {
  const searchQuery = normalizeSearchQuery(query);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, categoryId: true },
  });
  if (!product || !searchQuery) return null;

  const resolved = session ?? (await touchTrafficSession(context));
  await insertAnalyticsEvent({
    type: "SEARCH_RESULT_CLICK",
    ...eventBase(resolved, context),
    productId: product.id,
    categoryId: product.categoryId,
    searchQuery,
    dedupeKey: dedupeKey("SEARCH_RESULT_CLICK", [resolved.sessionId, product.id, searchQuery.toLowerCase()]),
  });

  return resolved;
}

export async function recordRetailerOfferView(linkId: string, context: TrackingContext, session?: ResolvedTrafficSession) {
  const link = await prisma.affiliateLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      productId: true,
      isActive: true,
      product: { select: { categoryId: true, status: true } },
      marketplace: { select: { isActive: true } },
    },
  });

  if (!link || !link.isActive || !link.marketplace.isActive || link.product.status !== "PUBLISHED") {
    return null;
  }

  const resolved = session ?? (await touchTrafficSession(context));
  await insertAnalyticsEvent({
    type: "RETAILER_OFFER_VIEW",
    ...eventBase(resolved, context),
    productId: link.productId,
    categoryId: link.product.categoryId,
    affiliateLinkId: link.id,
    dedupeKey: dedupeKey("RETAILER_OFFER_VIEW", [resolved.sessionId, link.id]),
  });

  return resolved;
}

export async function recordShare(productId: string | null, context: TrackingContext, session?: ResolvedTrafficSession) {
  const product = productId
    ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true, categoryId: true } })
    : null;

  const resolved = session ?? (await touchTrafficSession(context));
  await insertAnalyticsEvent({
    type: "SHARE",
    ...eventBase(resolved, context),
    productId: product?.id,
    categoryId: product?.categoryId,
    dedupeKey: dedupeKey("SHARE", [resolved.sessionId, product?.id ?? clean(context.path)]),
  });

  return resolved;
}

export async function getActiveAffiliateUrl(linkId: string): Promise<string | null> {
  const link = await prisma.affiliateLink.findUnique({
    where: { id: linkId },
    select: {
      affiliateUrl: true,
      isActive: true,
      product: { select: { status: true } },
      marketplace: { select: { isActive: true } },
    },
  });

  if (!link || !link.isActive || !link.marketplace.isActive || link.product.status !== "PUBLISHED") {
    return null;
  }
  return link.affiliateUrl;
}

export async function recordAffiliateClick(linkId: string, context: TrackingContext) {
  const link = await prisma.affiliateLink.findUnique({
    where: { id: linkId },
    include: {
      marketplace: { select: { id: true, isActive: true } },
      product: { select: { categoryId: true, status: true } },
    },
  });

  if (!link || !link.isActive || !link.marketplace.isActive || link.product.status !== "PUBLISHED") {
    return null;
  }

  const session = await touchTrafficSession(context);
  const inserted = await insertAnalyticsEvent({
    type: "AFFILIATE_CLICK",
    ...eventBase(session, context),
    productId: link.productId,
    categoryId: link.product.categoryId,
    affiliateLinkId: link.id,
    destinationUrl: clean(link.affiliateUrl, 2000),
    dedupeKey: dedupeKey("AFFILIATE_CLICK", [session.sessionId, link.id]),
  });

  if (inserted) {
    await prisma.affiliateClick.create({
      data: {
        productId: link.productId,
        affiliateLinkId: link.id,
        marketplaceId: link.marketplaceId,
        sessionId: session.sessionId,
        destinationUrl: link.affiliateUrl,
      },
    });
  }

  return { destinationUrl: link.affiliateUrl, visitorId: session.visitorId, sessionId: session.sessionId };
}

export async function recordOutboundClick(destinationUrl: string, context: TrackingContext) {
  const url = parseOutboundUrl(destinationUrl);
  if (!url) return null;

  const session = await touchTrafficSession(context);
  const href = url.toString();

  await insertAnalyticsEvent({
    type: "OUTBOUND_CLICK",
    ...eventBase(session, context),
    destinationUrl: clean(href, 2000),
    dedupeKey: dedupeKey("OUTBOUND_CLICK", [session.sessionId, `${url.host}${url.pathname}`]),
  });

  return { destinationUrl: href, visitorId: session.visitorId, sessionId: session.sessionId };
}

export type BeaconPayload = ParsedAnalyticsPayload;

async function resolveProductFromPath(path: string | null) {
  const slug = path ? PRODUCT_PATH.exec(path)?.[1] : null;
  if (!slug) return null;

  return prisma.product.findUnique({
    where: { slug },
    select: { id: true, categoryId: true },
  });
}

async function resolveCategoryFromPath(path: string | null) {
  const slug = path ? CATEGORY_PATH.exec(path)?.[1] : null;
  if (!slug) return null;

  return prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
}

/**
 * Single write-path for the public beacon. Classifies page / product /
 * category / search events so UI components never record analytics themselves.
 */
export async function recordBeaconEvents(payload: BeaconPayload, context: TrackingContext) {
  const requested = new Set(payload.events ?? []);
  const path = clean(payload.path) ?? clean(context.path) ?? "/";
  const searchQuery = normalizeSearchQuery(payload.search);
  const nextContext = { ...context, path, metadata: payload.metadata ?? context.metadata };

  const [productFromPath, categoryFromPath] = await Promise.all([
    payload.productId
      ? prisma.product.findUnique({ where: { id: payload.productId }, select: { id: true, categoryId: true } })
      : resolveProductFromPath(path),
    payload.categoryId
      ? prisma.category.findUnique({ where: { id: payload.categoryId }, select: { id: true } })
      : resolveCategoryFromPath(path),
  ]);

  const shouldRecord = (name: AnalyticsEventName) => requested.size === 0 || requested.has(name);
  const session = shouldRecord("page_view")
    ? await recordPageView(nextContext)
    : await touchTrafficSession(nextContext);

  if (shouldRecord("product_view") && productFromPath) {
    await recordProductView(productFromPath.id, nextContext, session);
  }

  if (shouldRecord("category_view") && categoryFromPath && !productFromPath) {
    await recordCategoryView(categoryFromPath.id, nextContext, session);
  }

  if (shouldRecord("search") && searchQuery) {
    await recordSearch(searchQuery, nextContext, session, payload.resultCount);
  } else if (shouldRecord("no_search_results") && searchQuery && payload.resultCount === 0) {
    await recordSearch(searchQuery, nextContext, session, 0);
  }

  if (shouldRecord("search_result_click") && productFromPath && searchQuery) {
    await recordSearchResultClick(productFromPath.id, searchQuery, nextContext, session);
  }

  if (shouldRecord("retailer_offer_view") && payload.affiliateLinkId) {
    await recordRetailerOfferView(payload.affiliateLinkId, nextContext, session);
  }

  if (shouldRecord("share") && (productFromPath || payload.productId)) {
    await recordShare(productFromPath?.id ?? payload.productId ?? null, nextContext, session);
  }

  if (shouldRecord("affiliate_click") && payload.affiliateLinkId) {
    await recordAffiliateClick(payload.affiliateLinkId, nextContext);
  }

  if (shouldRecord("outbound_click") && payload.destinationUrl) {
    await recordOutboundClick(payload.destinationUrl, nextContext);
  }

  return session;
}
