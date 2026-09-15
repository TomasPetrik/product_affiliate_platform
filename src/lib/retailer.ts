import type { MarketplaceCode } from "@/types/catalog";

export const RETAILER_LABELS: Record<MarketplaceCode, string> = {
  AMAZON: "Amazon",
  EBAY: "eBay",
  WALMART: "Walmart",
  BEST_BUY: "Best Buy",
  TARGET: "Target",
  OTHER: "Other",
};

export function retailerLabel(code: MarketplaceCode | string): string {
  return RETAILER_LABELS[code as MarketplaceCode] ?? code;
}

/** Retailers with a live import integration. Others can still be stored as manual offers. */
export const IMPORTABLE_RETAILERS = ["EBAY"] as const satisfies readonly MarketplaceCode[];
