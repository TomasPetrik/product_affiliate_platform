import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { ProductBadge, badgeForProduct, discountBadgeLabel } from "@/components/public/product-badge";
import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { ProductRating } from "@/components/public/product-rating";
import { SearchResultLink } from "@/components/public/search-tracking";
import { formatCurrency } from "@/lib/format";
import { productListImageUrl, productThumbImageUrl } from "@/lib/product-image-variants";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";

interface ProductCardProps {
  product: ProductSummary;
  className?: string;
  searchQuery?: string;
}

function CardMedia({
  product,
  badge,
  discountLabel,
  aspectClassName = "aspect-square",
  size = "card",
}: {
  product: ProductSummary;
  badge: ReturnType<typeof badgeForProduct>;
  discountLabel: string | null;
  aspectClassName?: string;
  size?: "card" | "thumb";
}) {
  const fullSrc = product.imageUrl;
  const listSrc = size === "thumb" ? productThumbImageUrl(fullSrc) : productListImageUrl(fullSrc);

  return (
    <div className={cn("relative overflow-hidden bg-image-well", aspectClassName)}>
      <ProductImagePlaceholder
        seed={product.slug}
        src={listSrc}
        fallbackSrc={fullSrc}
        alt={product.title}
        fit="contain"
        className="size-full rounded-none"
      />
      {badge ? (
        <div className="absolute left-3 top-3">
          <ProductBadge
            kind={badge}
            label={badge === "discount" && discountLabel ? discountLabel : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

function ViewProductCta({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "mt-4 inline-flex h-11 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[14px] bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-200 group-hover:bg-cta-hover",
        className,
      )}
    >
      View Product
      <ArrowRight className="size-4" aria-hidden="true" />
    </span>
  );
}

function PriceBlock({
  product,
  className,
  size = "default",
}: {
  product: ProductSummary;
  className?: string;
  size?: "default" | "lg";
}) {
  const showPrice = product.displayPrice > 0;

  if (!showPrice) {
    return <p className={cn("text-sm font-medium text-muted-foreground", className)}>Check current price</p>;
  }

  return (
    <p className={cn("text-price tracking-tight text-foreground", size === "lg" ? "text-2xl" : "text-base", className)}>
      {formatCurrency(product.displayPrice, product.currency)}
      {product.originalPrice ? (
        <span className="ml-2 text-sm font-medium text-muted-foreground line-through">
          {formatCurrency(product.originalPrice, product.currency)}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Editorial product card used across homepage rails, listing grids and
 * category pages. Links to the product detail page — affiliate CTAs live
 * on the PDP so outbound intent stays explicit.
 */
export function ProductCard({ product, className, searchQuery }: ProductCardProps) {
  const badge = badgeForProduct(product);
  const discountLabel = discountBadgeLabel(product.displayPrice, product.originalPrice);
  const href = `/products/${product.slug}`;
  const LinkComponent = searchQuery
    ? ({ children }: { children: ReactNode }) => (
        <SearchResultLink href={href} productId={product.id} searchQuery={searchQuery} className="flex h-full flex-col">
          {children}
        </SearchResultLink>
      )
    : ({ children }: { children: ReactNode }) => (
        <Link href={href} className="flex h-full flex-col">
          {children}
        </Link>
      );

  return (
    <article
      className={cn(
        "group h-full min-w-0 w-full overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <LinkComponent>
        <CardMedia product={product} badge={badge} discountLabel={discountLabel} />

        <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-4 sm:px-4 sm:pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="text-product-title mt-1.5 line-clamp-2 break-words text-sm text-foreground [overflow-wrap:anywhere] sm:text-[0.95rem]">
            {product.title}
          </h3>
          {product.shortDescription ? (
            <p className="mt-1.5 line-clamp-1 text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-2.5 min-h-5">
            <ProductRating rating={product.rating} count={product.ratingCount} />
          </div>

          <div className="mt-auto pt-3">
            <PriceBlock product={product} />
            <ViewProductCta />
          </div>
        </div>
      </LinkComponent>
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
  const discountLabel = discountBadgeLabel(product.displayPrice, product.originalPrice);
  const showPrice = product.displayPrice > 0;

  return (
    <article
      className={cn(
        "group h-full min-w-0 w-full overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <Link href={`/products/${product.slug}`} className="flex h-full flex-col">
        <CardMedia product={product} badge={badge} discountLabel={discountLabel} />

        <div className="flex flex-1 flex-col gap-1.5 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="text-product-title line-clamp-2 overflow-hidden break-words text-sm text-foreground [overflow-wrap:anywhere]">
            {product.title}
          </h3>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            {showPrice ? (
              <p className="text-price text-sm tracking-tight text-foreground sm:text-base">
                {formatCurrency(product.displayPrice, product.currency)}
                {product.originalPrice ? (
                  <span className="ml-1.5 text-xs font-medium text-muted-foreground line-through">
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
  const discountLabel = discountBadgeLabel(product.displayPrice, product.originalPrice);

  return (
    <article className="group overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <Link href={`/products/${product.slug}`} className="grid md:grid-cols-2">
        <CardMedia
          product={product}
          badge={badge}
          discountLabel={discountLabel}
          aspectClassName="aspect-[4/3] md:aspect-auto md:h-full md:min-h-[22rem]"
        />
        <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="text-product-title mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{product.title}</h3>
          {product.shortDescription ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {product.shortDescription}
            </p>
          ) : null}
          <div className="mt-4">
            <ProductRating rating={product.rating} count={product.ratingCount} />
          </div>
          <PriceBlock product={product} size="lg" className="mt-4" />
          <ViewProductCta className="mt-6 max-w-xs sm:w-auto sm:px-6" />
        </div>
      </Link>
    </article>
  );
}
