import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MarketplaceCode } from "@/types/catalog";

const MARKETPLACE_STYLES: Record<MarketplaceCode, string> = {
  AMAZON: "bg-amber-100 text-amber-900 border-amber-200",
  EBAY: "bg-blue-100 text-blue-900 border-blue-200",
};

const MARKETPLACE_LABELS: Record<MarketplaceCode, string> = {
  AMAZON: "Amazon",
  EBAY: "eBay",
};

interface MarketplaceBadgeProps {
  marketplace: MarketplaceCode;
  className?: string;
}

/** Small badge identifying which marketplace a product/link belongs to. */
export function MarketplaceBadge({ marketplace, className }: MarketplaceBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", MARKETPLACE_STYLES[marketplace], className)}
    >
      {MARKETPLACE_LABELS[marketplace]}
    </Badge>
  );
}
