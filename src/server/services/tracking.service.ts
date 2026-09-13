import { createHash, randomUUID } from "crypto";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const VISITOR_COOKIE = "findit_vid";
export const SESSION_COOKIE = "findit_sid";
export const TRACKING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface TrackingContext {
  visitorId: string;
  sessionId: string | null;
  path?: string;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${ip}:${env.AUTH_SECRET}`).digest("hex");
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export function newVisitorId(): string {
  return randomUUID();
}

export async function touchTrafficSession(
  context: TrackingContext,
): Promise<{ visitorId: string; sessionId: string }> {
  const visitorId = context.visitorId || newVisitorId();
  const now = new Date();

  const existing = context.sessionId
    ? await prisma.trafficSession.findUnique({ where: { id: context.sessionId } })
    : null;

  const session = existing
    ? await prisma.trafficSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          referrer: existing.referrer ?? clean(context.referrer),
          userAgent: existing.userAgent ?? clean(context.userAgent),
          landingPath: existing.landingPath ?? clean(context.path),
        },
      })
    : await prisma.trafficSession.create({
        data: {
          anonymousId: visitorId,
          landingPath: clean(context.path),
          referrer: clean(context.referrer),
          userAgent: clean(context.userAgent),
          ipHash: hashIp(context.ip),
          startedAt: now,
          lastSeenAt: now,
        },
      });

  const hasUtm = Boolean(context.source || context.medium || context.campaign || context.term || context.content);

  if (hasUtm) {
    const existingUtm = await prisma.uTMEvent.findFirst({
      where: { sessionId: session.id },
      select: { id: true },
    });

    if (!existingUtm) {
      await prisma.uTMEvent.create({
        data: {
          sessionId: session.id,
          source: clean(context.source),
          medium: clean(context.medium),
          campaign: clean(context.campaign),
          term: clean(context.term),
          content: clean(context.content),
          landingPath: clean(context.path),
          referrer: clean(context.referrer),
        },
      });
    }
  }

  return { visitorId, sessionId: session.id };
}

export async function recordProductView(productId: string, context: TrackingContext) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return null;

  const session = await touchTrafficSession(context);

  return prisma.productView.create({
    data: {
      productId,
      sessionId: session.sessionId,
      path: clean(context.path) ?? `/products`,
    },
  });
}

export async function recordAffiliateClick(linkId: string, context: TrackingContext) {
  const link = await prisma.affiliateLink.findUnique({
    where: { id: linkId },
    include: { marketplace: { select: { id: true } } },
  });

  if (!link || !link.isActive) {
    return null;
  }

  const session = await touchTrafficSession(context);

  await prisma.affiliateClick.create({
    data: {
      productId: link.productId,
      affiliateLinkId: link.id,
      marketplaceId: link.marketplaceId,
      sessionId: session.sessionId,
      destinationUrl: link.affiliateUrl,
    },
  });

  return { destinationUrl: link.affiliateUrl, visitorId: session.visitorId, sessionId: session.sessionId };
}
