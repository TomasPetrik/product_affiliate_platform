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

export function formatRelativeTime(isoDate: string | Date | null | undefined, now = new Date()): string {
  if (!isoDate) return "Never";
  const date = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  if (Number.isNaN(date.getTime())) return "Never";

  const deltaSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (deltaSeconds < 10) return "just now";
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;

  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
