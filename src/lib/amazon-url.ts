const CUSTOM_ID_MAX = 256;

/**
 * Extracts an Amazon ASIN from a product URL or returns a bare ASIN as-is.
 * Supports /dp/, /gp/product/, and /ASIN/ path shapes.
 */
export function extractAmazonAsin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.includes("amazon.")) {
      return null;
    }

    const match = url.pathname.match(/\/(?:dp|gp\/product|ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** Reads the Associates account `tag` query param from an Amazon URL. */
export function extractAmazonPartnerTag(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const tag = url.searchParams.get("tag")?.trim();
    return tag || null;
  } catch {
    return null;
  }
}

/** Reads the per-click / per-product `ascsubtag` from an Amazon URL. */
export function extractAmazonAscSubtag(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const sub = url.searchParams.get("ascsubtag")?.trim();
    return sub || null;
  } catch {
    return null;
  }
}

/**
 * Deterministic Associates sub-tag (`ascsubtag`) so clicks can be attributed
 * back to a RadarCut product (or the ASIN when the product is not known yet).
 */
export function amazonAffiliateReferenceId(input: {
  productId?: string | null;
  asin?: string | null;
}): string {
  if (input.productId?.trim()) {
    return clip(`radarcut-product-${input.productId.trim()}`);
  }
  if (input.asin?.trim()) {
    return clip(`radarcut-amazon-${input.asin.trim().toUpperCase()}`);
  }
  return "radarcut";
}

/**
 * Builds (or rewrites) an Amazon product URL with the Associates partner tag
 * and a RadarCut `ascsubtag` (unique product/reference id).
 */
export function applyAmazonTrackingTag(input: {
  url: string;
  partnerTag: string;
  customId?: string | null;
}): string {
  const partnerTag = input.partnerTag.trim();
  if (!partnerTag) {
    throw new Error("Amazon Associates partner tag is required.");
  }

  const url = new URL(input.url.trim());
  url.searchParams.set("tag", partnerTag);
  const customId = input.customId?.trim();
  if (customId) {
    url.searchParams.set("ascsubtag", customId);
  }
  return url.toString();
}

/**
 * Resolves a tracked Amazon affiliate URL from whatever the admin pasted
 * (affiliate URL, raw product URL, or bare ASIN).
 *
 * - `tag` comes from AMAZON_ASSOCIATES_TAG (account-level; same for every link)
 * - `trackingTag` / `ascsubtag` is unique per product for attribution
 */
export function generateAmazonTrackedAffiliate(input: {
  affiliateUrl?: string | null;
  rawProductUrl?: string | null;
  asin?: string | null;
  partnerTag: string;
  productId?: string | null;
  /** Existing unique sub-tag to keep; generated when omitted. */
  customId?: string | null;
  host?: string;
}): { affiliateUrl: string; trackingTag: string; partnerTag: string; asin: string | null; customId: string } {
  const partnerTag = input.partnerTag.trim();
  if (!partnerTag) {
    throw new Error("Set AMAZON_ASSOCIATES_TAG in .env first.");
  }

  const asin =
    extractAmazonAsin(input.asin ?? "") ??
    extractAmazonAsin(input.affiliateUrl ?? "") ??
    extractAmazonAsin(input.rawProductUrl ?? "") ??
    null;

  const source =
    pickHttpUrl(input.affiliateUrl) ??
    pickHttpUrl(input.rawProductUrl) ??
    (asin ? `https://${input.host ?? "www.amazon.com"}/dp/${asin}` : null);

  if (!source) {
    throw new Error("Paste an Amazon product URL or ASIN first.");
  }

  const existingCustomId = input.customId?.trim();
  const customId =
    existingCustomId && existingCustomId !== partnerTag
      ? existingCustomId
      : amazonAffiliateReferenceId({ productId: input.productId, asin });

  const affiliateUrl = applyAmazonTrackingTag({
    url: source,
    partnerTag,
    customId,
  });

  return {
    affiliateUrl,
    trackingTag: customId,
    partnerTag,
    asin,
    customId,
  };
}

function pickHttpUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

function clip(value: string): string {
  return value.slice(0, CUSTOM_ID_MAX);
}
