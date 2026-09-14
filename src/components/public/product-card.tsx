import Link from "next/link";
import { Star, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MarketplaceBadge } from "@/components/public/marketplace-badge";
import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { formatCurrency, formatDiscountPercent, formatRating } from "@/lib/format";
import type { ProductSummary } from "@/types/catalog";

interface ProductCardProps {
  product: ProductSummary;
}

/**
 * Reusable product card used across the homepage rails, listing grid and
 * category pages. Links to the product detail page — the affiliate CTA
 * itself only lives on the PDP, keeping outbound intent explicit.
 */
export function ProductCard({ product }: ProductCardProps) {
  const discount = formatDiscountPercent(product.displayPrice, product.originalPrice);

  const marketplaces = [...product.marketplaces].sort((a, b) =>
    a.marketplace.localeCompare(b.marketplace),
  );

  return (
    <Card className="group h-full gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="block shrink-0">
        <div className="relative overflow-hidden">
          <ProductImagePlaceholder
            seed={product.slug}
            src={product.imageUrl}
            alt={product.title}
            className="aspect-square w-full rounded-none"
          />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
            {product.isTrending ? (
              <Badge className="gap-1 bg-orange-600 text-white hover:bg-orange-600">
                <TrendingUp className="h-3 w-3" /> Trending
              </Badge>
            ) : null}
            {product.isFeatured ? <Badge variant="secondary">Featured</Badge> : null}
          </div>
          {discount ? (
            <Badge className="absolute right-2 top-2 bg-emerald-600 text-white hover:bg-emerald-600">
              -{discount}%
            </Badge>
          ) : null}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col pt-4 pb-3">
        <p className="truncate text-xs font-medium text-muted-foreground">{product.category.name}</p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 transition-colors group-hover:text-primary">
            {product.title}
          </h3>
        </Link>

        <div className="mt-2 flex h-5 items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="font-medium text-foreground">{formatRating(product.rating)}</span>
          <span>({product.ratingCount.toLocaleString()})</span>
        </div>

        <div className="mt-2 flex h-7 items-baseline gap-2">
          <span className="text-lg font-semibold">{formatCurrency(product.displayPrice, product.currency)}</span>
          {product.originalPrice ? (
            <span className="text-sm text-muted-foreground line-through">
              {formatCurrency(product.originalPrice, product.currency)}
            </span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="mt-auto h-12 shrink-0 flex-nowrap items-center gap-1.5 rounded-none p-0 px-4">
        {marketplaces.map((link) => (
          <MarketplaceBadge key={link.marketplace} marketplace={link.marketplace} />
        ))}
      </CardFooter>
    </Card>
  );
}
