export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatCompactCount(count: number): string {
  if (count < 1000) {
    return count.toLocaleString("en-US");
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(count);
}

export function formatDiscountPercent(displayPrice: number, originalPrice: number | null): number | null {
  if (!originalPrice || originalPrice <= displayPrice) {
    return null;
  }

  return Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
}

/** Stored catalog discount; same formula as the public badge. */
export function computeDiscountPercentage(displayPrice: number, originalPrice: number | null): number | null {
  return formatDiscountPercent(displayPrice, originalPrice);
}
