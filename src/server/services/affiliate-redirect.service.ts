import { unstable_cache } from "next/cache";

import { affiliateGoHref, isProductSlug, parseLinkIdParam, parseMarketplaceParam } from "@/lib/affiliate-go";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { parseOutboundUrl } from "@/server/services/tracking.service";

export const AFFILIATE_REDIRECT_CACHE_TAG = "affiliate-redirect";
export const AFFILIATE_REDIRECT_CACHE_SECONDS = 60;

export interface ResolvedAffiliateTarget {
  linkId: string;
  productId: string;
  productSlug: string;
  marketplaceCode: string;
  destinationUrl: string;
}

/**
 * Destination URLs are taken only from stored affiliate links.
 * Reject anything that is not http(s), carries credentials, or points
 * back at this site (which would loop `/go` → `/go`).
 */
export function sanitizeAffiliateDestination(raw: string): string | null {
  const url = parseOutboundUrl(raw);
  if (!url) return null;
  if (url.username || url.password) return null;

  try {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL);
    if (url.hostname === site.hostname) return null;
  } catch {
    return null;
  }

  return url.toString();
}

async function lookupPublishedAffiliateTarget(
  slug: string,
  marketplaceCode: string | null,
  linkId: string | null,
): Promise<ResolvedAffiliateTarget | null> {
  if (!isProductSlug(slug)) return null;

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      affiliateLinks: {
        where: { isActive: true, marketplace: { isActive: true } },
        select: {
          id: true,
          affiliateUrl: true,
          isPrimary: true,
          marketplace: { select: { code: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!product || product.status !== "PUBLISHED") {
    return null;
  }

  const selected = linkId
    ? product.affiliateLinks.find((link) => link.id === linkId)
    : marketplaceCode
      ? product.affiliateLinks.find((link) => link.marketplace.code === marketplaceCode)
      : (product.affiliateLinks.find((link) => link.isPrimary) ?? product.affiliateLinks[0]);

  if (!selected) {
    return null;
  }

  const destinationUrl = sanitizeAffiliateDestination(selected.affiliateUrl);
  if (!destinationUrl) {
    return null;
  }

  return {
    linkId: selected.id,
    productId: product.id,
    productSlug: product.slug,
    marketplaceCode: selected.marketplace.code,
    destinationUrl,
  };
}

export function resolvePublishedAffiliateTarget(
  slug: string,
  marketplaceCode: string | null,
  linkId: string | null = null,
) {
  return unstable_cache(
    () => lookupPublishedAffiliateTarget(slug, marketplaceCode, linkId),
    ["affiliate-redirect", slug, marketplaceCode ?? "", linkId ?? ""],
    {
      revalidate: AFFILIATE_REDIRECT_CACHE_SECONDS,
      tags: [AFFILIATE_REDIRECT_CACHE_TAG, `${AFFILIATE_REDIRECT_CACHE_TAG}:${slug}`],
    },
  )();
}

export function resolveAffiliateGoPathFromLinkId(linkId: string): Promise<string | null> {
  if (!linkId || linkId.length > 64) return Promise.resolve(null);

  return unstable_cache(
    async () => {
      const link = await prisma.affiliateLink.findUnique({
        where: { id: linkId },
        select: {
          id: true,
          isActive: true,
          marketplace: { select: { code: true, isActive: true } },
          product: { select: { slug: true, status: true } },
        },
      });

      if (!link || !link.isActive || !link.marketplace.isActive || link.product.status !== "PUBLISHED") {
        return null;
      }

      return affiliateGoHref(link.product.slug, link.marketplace.code, link.id);
    },
    ["affiliate-redirect-link", linkId],
    {
      revalidate: AFFILIATE_REDIRECT_CACHE_SECONDS,
      tags: [AFFILIATE_REDIRECT_CACHE_TAG, `${AFFILIATE_REDIRECT_CACHE_TAG}:link:${linkId}`],
    },
  )();
}

export function resolvePublishedAffiliateTargetByOfferId(offerId: string) {
  const linkId = parseLinkIdParam(offerId);
  if (!linkId) return Promise.resolve(null);

  return unstable_cache(
    async (): Promise<ResolvedAffiliateTarget | null> => {
      const link = await prisma.affiliateLink.findUnique({
        where: { id: linkId },
        select: {
          id: true,
          affiliateUrl: true,
          isActive: true,
          productId: true,
          marketplace: { select: { code: true, isActive: true } },
          product: { select: { slug: true, status: true } },
        },
      });

      if (!link || !link.isActive || !link.marketplace.isActive || link.product.status !== "PUBLISHED") {
        return null;
      }

      const destinationUrl = sanitizeAffiliateDestination(link.affiliateUrl);
      if (!destinationUrl) return null;

      return {
        linkId: link.id,
        productId: link.productId,
        productSlug: link.product.slug,
        marketplaceCode: link.marketplace.code,
        destinationUrl,
      };
    },
    ["affiliate-redirect-offer", linkId],
    {
      revalidate: AFFILIATE_REDIRECT_CACHE_SECONDS,
      tags: [AFFILIATE_REDIRECT_CACHE_TAG, `${AFFILIATE_REDIRECT_CACHE_TAG}:link:${linkId}`],
    },
  )();
}

export function marketplaceFromRequest(searchParams: URLSearchParams): string | null {
  return parseMarketplaceParam(searchParams.get("m") ?? searchParams.get("marketplace"));
}

export function linkIdFromRequest(searchParams: URLSearchParams): string | null {
  return parseLinkIdParam(searchParams.get("lid") ?? searchParams.get("linkId"));
}
