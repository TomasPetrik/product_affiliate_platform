/**
 * Public affiliate hop URLs. Buttons must point here — never at a raw
 * marketplace URL, and never at an internal affiliate-link id.
 *
 *   /go/magnetic-car-phone-holder
 *   /go/magnetic-car-phone-holder?m=amazon
 *   /go/magnetic-car-phone-holder?m=ebay
 */

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

export function affiliateGoHref(productSlug: string, marketplaceCode?: string): string {
  const path = `/go/${productSlug}`;
  if (!marketplaceCode) {
    return path;
  }
  return `${path}?m=${marketplaceCode.toLowerCase()}`;
}
