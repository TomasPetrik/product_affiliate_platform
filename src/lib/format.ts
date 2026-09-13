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

export function formatDiscountPercent(displayPrice: number, originalPrice: number | null): number | null {
  if (!originalPrice || originalPrice <= displayPrice) {
    return null;
  }

  return Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
}
