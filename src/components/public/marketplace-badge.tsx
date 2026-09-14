import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MarketplaceCode } from "@/types/catalog";

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
    <Badge variant="outline" className={cn("rounded-md font-medium text-muted-foreground", className)}>
      {MARKETPLACE_LABELS[marketplace]}
    </Badge>
  );
}
