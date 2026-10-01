/**
 * Storefront rules for when Amazon should be the only visible retailer.
 * Used by the public catalog and affiliate redirect resolution.
 */

export interface AmazonOfferPreferenceFlags {
  preferAmazonWhenCheapest: boolean;
  forceAmazonOnly: boolean;
}

export const DEFAULT_AMAZON_OFFER_PREFERENCE: AmazonOfferPreferenceFlags = {
  preferAmazonWhenCheapest: false,
  forceAmazonOnly: false,
};

export interface PricedMarketplaceOffer {
  marketplace: string;
  price: number | null;
}

/** True when at least one Amazon offer shares the lowest known price (ties count). */
export function amazonIsCheapestAmongOffers(offers: PricedMarketplaceOffer[]): boolean {
  let minPrice = Infinity;
  let amazonAtMin = false;

  for (const offer of offers) {
    if (offer.price == null) continue;
    const price = Number(offer.price);
    if (!Number.isFinite(price) || price < 0) continue;

    if (price < minPrice) {
      minPrice = price;
      amazonAtMin = offer.marketplace === "AMAZON";
    } else if (price === minPrice && offer.marketplace === "AMAZON") {
      amazonAtMin = true;
    }
  }

  return Number.isFinite(minPrice) && amazonAtMin;
}

/**
 * Filters offers for public display / redirect eligibility.
 * `forceAmazonOnly` wins over `preferAmazonWhenCheapest`.
 * When neither flag is on, offers are returned unchanged.
 */
export function filterOffersByAmazonPreference<T extends PricedMarketplaceOffer>(
  offers: T[],
  flags: AmazonOfferPreferenceFlags,
): T[] {
  if (flags.forceAmazonOnly) {
    return offers.filter((offer) => offer.marketplace === "AMAZON");
  }

  if (flags.preferAmazonWhenCheapest && amazonIsCheapestAmongOffers(offers)) {
    return offers.filter((offer) => offer.marketplace === "AMAZON");
  }

  return offers;
}
