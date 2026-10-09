/**
 * Public affiliate hop URLs. Buttons must point here — never at a raw
 * marketplace URL, and never at an internal affiliate-link id.
 *
 *   /go/magnetic-car-phone-holder
 *   /go/magnetic-car-phone-holder?m=amazon
 *   /go/magnetic-car-phone-holder?m=ebay
 */

import {
  filterOffersByAmazonPreference,
  type AmazonOfferPreferenceFlags,
} from "@/lib/amazon-offer-preference";

export const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MARKETPLACE_PARAM_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export function isProductSlug(value: string): boolean {
  return PRODUCT_SLUG_PATTERN.test(value);
}

/** Normalize `?m=` / `?marketplace=` to an uppercase marketplace code, or null. */
export function parseMarketplaceParam(raw: string | null | undefined): string | null {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized || !MARKETPLACE_PARAM_PATTERN.test(normalized)) {
    return null;
  }
  return normalized.toUpperCase();
}

export function parseLinkIdParam(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > 64) return null;
  if (!/^[a-z0-9_-]+$/i.test(value)) return null;
  return value;
}

export interface AffiliateHopLinkCandidate {
  marketplace: string;
  isPrimary: boolean;
  isActive?: boolean;
  affiliateUrl?: string | null;
  price?: number | null;
}

/**
 * Marketplace code that a public `/go/{slug}?m=` hop should use.
 * Skips inactive / empty URLs and respects Amazon-only storefront flags so we
 * never emit `m=ebay` when eBay is not actually reachable.
 */
export function pickAffiliateHopMarketplaceCode(
  links: AffiliateHopLinkCandidate[],
  flags?: AmazonOfferPreferenceFlags,
): string | undefined {
  const usable = links.filter(
    (link) =>
      link.isActive !== false &&
      Boolean(link.marketplace?.trim()) &&
      (link.affiliateUrl == null || link.affiliateUrl.trim().length > 0),
  );

  const visible = flags
    ? filterOffersByAmazonPreference(
        usable.map((link) => ({
          ...link,
          marketplace: link.marketplace.trim().toUpperCase(),
          price: link.price ?? null,
        })),
        flags,
      )
    : usable.map((link) => ({
        ...link,
        marketplace: link.marketplace.trim().toUpperCase(),
      }));

  return (visible.find((link) => link.isPrimary) ?? visible[0])?.marketplace;
}

/** Public hop that records an offer click without exposing a raw retailer URL. */
export function affiliateOfferGoHref(offerId: string): string {
  const id = parseLinkIdParam(offerId);
  return id ? `/go/offer/${id}` : "/";
}

export function affiliateGoHref(productSlug: string, marketplaceCode?: string, linkId?: string): string {
  const path = `/go/${productSlug}`;
  const params = new URLSearchParams();
  if (marketplaceCode) {
    params.set("m", marketplaceCode.toLowerCase());
  }
  if (linkId) {
    params.set("lid", linkId);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
