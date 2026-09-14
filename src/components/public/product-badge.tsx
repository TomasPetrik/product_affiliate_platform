import { cn } from "@/lib/utils";

export type ProductBadgeKind = "editors-pick" | "trending" | "best-seller";

const LABELS: Record<ProductBadgeKind, string> = {
  "editors-pick": "Editor's Pick",
  trending: "Trending",
  "best-seller": "Best Seller",
};

interface ProductBadgeProps {
  kind: ProductBadgeKind;
  className?: string;
}

export function ProductBadge({ kind, className }: ProductBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border/80 bg-card/95 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-foreground backdrop-blur-sm",
        className,
      )}
    >
      {LABELS[kind]}
    </span>
  );
}

export function badgeForProduct(product: { isFeatured: boolean; isTrending: boolean; ratingCount: number }): ProductBadgeKind | null {
  if (product.isFeatured) return "editors-pick";
  if (product.isTrending) return "trending";
  if (product.ratingCount >= 4000) return "best-seller";
  return null;
}
