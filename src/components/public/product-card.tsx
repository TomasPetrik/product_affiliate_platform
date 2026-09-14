import Link from "next/link";

import { ProductBadge, badgeForProduct } from "@/components/public/product-badge";
import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { ProductRating } from "@/components/public/product-rating";
import { formatCurrency, formatDiscountPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";

interface ProductCardProps {
  product: ProductSummary;
  className?: string;
}

/**
 * Editorial product card used across homepage rails, listing grids and
 * category pages. Links to the product detail page — affiliate CTAs live
 * on the PDP so outbound intent stays explicit.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const badge = badgeForProduct(product);
  const showPrice = product.displayPrice > 0;

  return (
    <article
      className={cn(
        "group h-full overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <Link href={`/products/${product.slug}`} className="flex h-full flex-col">
        <div className="relative overflow-hidden bg-muted">
          <ProductImagePlaceholder
            seed={product.slug}
            src={product.imageUrl}
            alt={product.title}
            className="aspect-square w-full rounded-none transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
          {badge ? (
            <div className="absolute left-2.5 top-2.5">
              <ProductBadge kind={badge} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="mt-1.5 line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground sm:text-[0.95rem]">
            {product.title}
          </h3>
          {product.shortDescription ? (
            <p className="mt-1.5 hidden line-clamp-2 text-sm leading-relaxed text-muted-foreground sm:block">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-2 min-h-5">
            <ProductRating rating={product.rating} count={product.ratingCount} />
          </div>

          <div className="mt-auto pt-3">
            {showPrice ? (
              <p className="text-base font-bold tracking-tight text-foreground">
                {formatCurrency(product.displayPrice, product.currency)}
                {product.originalPrice ? (
                  <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                    {formatCurrency(product.originalPrice, product.currency)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Check current price</p>
            )}

            <span className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background transition-colors group-hover:bg-foreground/90">
              View Product
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

interface CompactProductCardProps {
  product: ProductSummary;
  className?: string;
}

/** Image-forward card for the homepage hero mosaic. */
export function CompactProductCard({ product, className }: CompactProductCardProps) {
  const badge = badgeForProduct(product);
  const showPrice = product.displayPrice > 0;
  const discount = formatDiscountPercent(product.displayPrice, product.originalPrice);

  return (
    <article
      className={cn(
        "group h-full overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <Link href={`/products/${product.slug}`} className="flex h-full flex-col">
        <div className="relative overflow-hidden bg-muted">
          <ProductImagePlaceholder
            seed={product.slug}
            src={product.imageUrl}
            alt={product.title}
            className="aspect-square w-full rounded-none transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
          {badge ? (
            <div className="absolute left-2.5 top-2.5">
              <ProductBadge kind={badge} />
            </div>
          ) : null}
          {discount ? (
            <span className="absolute right-2.5 top-2.5 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {discount}% off
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground">
            {product.title}
          </h3>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            {showPrice ? (
              <p className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                {formatCurrency(product.displayPrice, product.currency)}
                {product.originalPrice ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">
                    {formatCurrency(product.originalPrice, product.currency)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">See price</p>
            )}
            <ProductRating
              rating={product.rating}
              count={product.ratingCount}
              compact
              className="hidden sm:flex"
            />
          </div>
        </div>
      </Link>
    </article>
  );
}

interface SpotlightProductCardProps {
  product: ProductSummary;
}

/** Wide editorial card for featured / editor's-pick rails. */
export function SpotlightProductCard({ product }: SpotlightProductCardProps) {
  const badge = badgeForProduct(product);
  const showPrice = product.displayPrice > 0;

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-[box-shadow] duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <Link href={`/products/${product.slug}`} className="grid md:grid-cols-2">
        <div className="relative overflow-hidden bg-muted">
          <ProductImagePlaceholder
            seed={product.slug}
            src={product.imageUrl}
            alt={product.title}
            className="aspect-[4/3] w-full rounded-none md:aspect-auto md:h-full md:min-h-[20rem] transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
          {badge ? (
            <div className="absolute left-3 top-3">
              <ProductBadge kind={badge} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col justify-center p-5 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{product.title}</h3>
          {product.shortDescription ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {product.shortDescription}
            </p>
          ) : null}
          <div className="mt-4">
            <ProductRating rating={product.rating} count={product.ratingCount} />
          </div>
          {showPrice ? (
            <p className="mt-4 text-2xl font-bold tracking-tight">
              {formatCurrency(product.displayPrice, product.currency)}
            </p>
          ) : null}
          <span className="mt-6 inline-flex h-11 w-full max-w-xs items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background transition-colors group-hover:bg-foreground/90 sm:w-auto sm:px-6">
            View Product
          </span>
        </div>
      </Link>
    </article>
  );
}
