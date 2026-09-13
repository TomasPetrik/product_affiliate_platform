import { createHash, randomUUID } from "crypto";

import type { AnalyticsEventType, DeviceType, Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const VISITOR_COOKIE = "findit_vid";
export const SESSION_COOKIE = "findit_sid";
export const TRACKING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "product_view",
  "category_view",
  "search",
  "affiliate_click",
  "outbound_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const DEDUPE_WINDOW_MS: Record<AnalyticsEventType, number> = {
  PAGE_VIEW: 10_000,
  PRODUCT_VIEW: 30 * 60 * 1000,
  CATEGORY_VIEW: 30 * 60 * 1000,
  SEARCH: 15_000,
  AFFILIATE_CLICK: 10_000,
  OUTBOUND_CLICK: 10_000,
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
  deviceType?: DeviceType | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

export interface ResolvedTrafficSession {
  visitorId: string;
  sessionId: string;
  landingPath: string | null;
  referrer: string | null;
  deviceType: DeviceType | null;
  country: string | null;
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

export function newVisitorId(): string {
  return randomUUID();
}

export function countryFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  const raw =
    headerStore.get("cf-ipcountry") ??
    headerStore.get("x-vercel-ip-country") ??
    headerStore.get("cloudfront-viewer-country") ??
    headerStore.get("x-country-code");

  if (!raw) return null;

  const code = raw.trim().toUpperCase();
  if (code === "XX" || code === "T1") return null;
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function clientIpFromHeaders(headerStore: { get(name: string): string | null }): string | null {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip") ?? null;
}

export function normalizeDeviceType(value: string | null | undefined): DeviceType | null {
  if (!value) return "DESKTOP";
  const normalized = value.toLowerCase();
  if (normalized === "mobile") return "MOBILE";
  if (normalized === "tablet") return "TABLET";
  if (normalized === "desktop") return "DESKTOP";
  return "DESKTOP";
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

function firstUtm(context: TrackingContext, session: { source: string | null; medium: string | null; campaign: string | null; term: string | null; content: string | null }) {
  return {
    source: clean(context.source, 200) ?? session.source,
    medium: clean(context.medium, 200) ?? session.medium,
    campaign: clean(context.campaign, 200) ?? session.campaign,
    term: clean(context.term, 200) ?? session.term,
    content: clean(context.content, 200) ?? session.content,
  };
}

export async function touchTrafficSession(context: TrackingContext): Promise<ResolvedTrafficSession> {
  const visitorId = context.visitorId || newVisitorId();
  const now = new Date();
  const deviceType = context.deviceType ?? null;
  const country = clean(context.country, 2);

  const existing = context.sessionId
    ? await prisma.trafficSession.findUnique({
        where: { id: context.sessionId },
        include: { utmEvents: { orderBy: { createdAt: "asc" }, take: 1 } },
      })
    : null;

  const sessionIsFresh = existing ? now.getTime() - existing.lastSeenAt.getTime() < SESSION_IDLE_MS : false;

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
        },
        include: { utmEvents: { orderBy: { createdAt: "asc" }, take: 1 } },
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
          startedAt: now,
          lastSeenAt: now,
        },
        include: { utmEvents: { orderBy: { createdAt: "asc" }, take: 1 } },
      });

  const hasUtm = Boolean(context.source || context.medium || context.campaign || context.term || context.content);
  let utm = session.utmEvents[0] ?? null;

  if (hasUtm && !utm) {
    utm = await prisma.uTMEvent.create({
      data: {
        sessionId: session.id,
        source: clean(context.source, 200),
        medium: clean(context.medium, 200),
        campaign: clean(context.campaign, 200),
        term: clean(context.term, 200),
        content: clean(context.content, 200),
        landingPath: clean(context.path),
        referrer: clean(context.referrer),
      },
    });
  }

  return {
    visitorId,
    sessionId: session.id,
    landingPath: session.landingPath,
    referrer: session.referrer,
    deviceType: session.deviceType,
    country: session.country,
    source: utm?.source ?? clean(context.source, 200),
    medium: utm?.medium ?? clean(context.medium, 200),
    campaign: utm?.campaign ?? clean(context.campaign, 200),
    term: utm?.term ?? clean(context.term, 200),
    content: utm?.content ?? clean(context.content, 200),
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
  const utm = firstUtm(context, session);

  return {
    visitorId: session.visitorId,
    sessionId: session.sessionId,
    path: clean(context.path),
    landingPath: session.landingPath,
    referrer: clean(context.referrer) ?? session.referrer,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    utmContent: utm.content,
    utmTerm: utm.term,
    deviceType: session.deviceType,
    country: session.country,
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

export async function recordSearch(query: string, context: TrackingContext, session?: ResolvedTrafficSession) {
  const searchQuery = normalizeSearchQuery(query);
  if (!searchQuery) return null;

  const resolved = session ?? (await touchTrafficSession(context));
  await insertAnalyticsEvent({
    type: "SEARCH",
    ...eventBase(resolved, context),
    searchQuery,
    dedupeKey: dedupeKey("SEARCH", [resolved.sessionId, searchQuery.toLowerCase()]),
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

export interface BeaconPayload {
  path?: string | null;
  search?: string | null;
  referrer?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  destinationUrl?: string | null;
  affiliateLinkId?: string | null;
  events?: AnalyticsEventName[];
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

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
  const nextContext = { ...context, path };

  const [productFromPath, categoryFromPath] = await Promise.all([
    payload.productId
      ? prisma.product.findUnique({ where: { id: payload.productId }, select: { id: true, categoryId: true } })
      : resolveProductFromPath(path),
    payload.categoryId
      ? prisma.category.findUnique({ where: { id: payload.categoryId }, select: { id: true } })
      : resolveCategoryFromPath(path),
  ]);

  const session = await recordPageView(nextContext);

  const shouldRecord = (name: AnalyticsEventName) => requested.size === 0 || requested.has(name);

  if (shouldRecord("product_view") && productFromPath) {
    await recordProductView(productFromPath.id, nextContext, session);
  }

  if (shouldRecord("category_view") && categoryFromPath && !productFromPath) {
    await recordCategoryView(categoryFromPath.id, nextContext, session);
  }

  if (shouldRecord("search") && searchQuery) {
    await recordSearch(searchQuery, nextContext, session);
  }

  if (shouldRecord("affiliate_click") && payload.affiliateLinkId) {
    await recordAffiliateClick(payload.affiliateLinkId, nextContext);
  }

  if (shouldRecord("outbound_click") && payload.destinationUrl) {
    await recordOutboundClick(payload.destinationUrl, nextContext);
  }

  return session;
}
