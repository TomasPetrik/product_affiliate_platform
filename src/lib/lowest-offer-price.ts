/**
 * Picks the cheapest offer among those with a known price.
 * Used for denormalized Product.displayPrice and public card/PDP pricing.
 */
export function pickLowestPricedOffer<T extends { lastKnownPrice: unknown }>(offers: T[]): T | null {
  let best: T | null = null;
  let bestPrice = Infinity;

  for (const offer of offers) {
    if (offer.lastKnownPrice == null) continue;
    const price = Number(offer.lastKnownPrice);
    if (!Number.isFinite(price) || price < 0) continue;
    if (price < bestPrice) {
      bestPrice = price;
      best = offer;
    }
  }

  return best;
}
