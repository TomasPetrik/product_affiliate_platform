import { formatDiscountPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProductBadgeKind = "editors-pick" | "best-seller" | "trending" | "new" | "discount";

const LABELS: Record<ProductBadgeKind, string> = {
  "editors-pick": "Editor's Pick",
  "best-seller": "Best Seller",
  trending: "Trending",
  new: "New",
  discount: "Sale",
};

const STYLES: Record<ProductBadgeKind, string> = {
  "editors-pick": "border-transparent bg-foreground text-background",
  "best-seller": "border-rating/40 bg-rating-soft text-foreground",
  trending: "border-transparent bg-[#FDEEEA] text-[#9A4538]",
  new: "border-transparent bg-[#EAF2FA] text-[#2F5F86]",
  discount: "border-[#E8C4BC] bg-[#FBF6F5] text-[#A85A4C]",
};

const NEW_PRODUCT_MS = 1000 * 60 * 60 * 24 * 30;

interface ProductBadgeProps {
  kind: ProductBadgeKind;
  label?: string;
  className?: string;
}

export function ProductBadge({ kind, label, className }: ProductBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide backdrop-blur-sm",
        STYLES[kind],
        className,
      )}
    >
      {label ?? LABELS[kind]}
    </span>
  );
}

export function isNewProduct(publishedAt?: string): boolean {
  if (!publishedAt) return false;
  const timestamp = new Date(publishedAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp < NEW_PRODUCT_MS;
}

export function badgeForProduct(product: {
  isFeatured: boolean;
  isTrending: boolean;
  ratingCount: number;
  publishedAt?: string;
  displayPrice?: number;
  originalPrice?: number | null;
}): ProductBadgeKind | null {
  if (product.isFeatured) return "editors-pick";
  if (product.ratingCount >= 4000) return "best-seller";
  if (product.isTrending) return "trending";
  if (isNewProduct(product.publishedAt)) return "new";

  const discount = formatDiscountPercent(product.displayPrice ?? 0, product.originalPrice ?? null);
  if (discount) return "discount";

  return null;
}

export function discountBadgeLabel(displayPrice: number, originalPrice: number | null): string | null {
  const discount = formatDiscountPercent(displayPrice, originalPrice);
  return discount ? `${discount}% Off` : null;
}
