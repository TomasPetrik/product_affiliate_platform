/** Format a WaveSpeed USD amount for admin UI. */
export function formatWanCostUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2,
  }).format(amount);
}

export function sumWanCostUsd(
  amounts: Array<number | null | undefined>,
): number {
  let total = 0;
  for (const amount of amounts) {
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
      total += amount;
    }
  }
  return total;
}
