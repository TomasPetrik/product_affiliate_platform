import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AffiliateCtaButton } from "@/components/public/affiliate-cta-button";
import { Container } from "@/components/public/container";
import { ProductCollection } from "@/components/public/product-collection";
import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { ProductBadge, badgeForProduct, discountBadgeLabel } from "@/components/public/product-badge";
import { RadarScore } from "@/components/public/radar-score";
import { formatCurrency, formatDiscountPercent } from "@/lib/format";
import type { ProductDetail, ProductSummary } from "@/types/catalog";

interface ProductPageViewProps {
  product: ProductDetail;
  related: ProductSummary[];
  trackViews?: boolean;
}

function editorialNote(product: ProductDetail): string | null {
  if (product.isFeatured) return "The one we'd pick.";
  if (product.ratingCount >= 4000) return "People keep coming back to this one.";
  if (product.isTrending) return "Worth the hype? We think so.";
  return null;
}

export function ProductPageView({ product, related, trackViews = true }: ProductPageViewProps) {
  const discount = formatDiscountPercent(product.displayPrice, product.originalPrice);
  const discountLabel = discountBadgeLabel(product.displayPrice, product.originalPrice);
  const badge = badgeForProduct(product);
  const showPrice = product.displayPrice > 0;
  const note = editorialNote(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    brand: { "@type": "Brand", name: product.brand },
    aggregateRating:
      product.rating > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.ratingCount,
          }
        : undefined,
  };

  return (
    <div className="pb-16">
      {trackViews ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}

      <Container className="pt-8 sm:pt-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/categories/${product.category.slug}`} />}>
                {product.category.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1">{product.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="relative overflow-hidden rounded-[16px] border border-border bg-image-well">
            <ProductImagePlaceholder
              seed={product.slug}
              src={product.imageUrl}
              alt={product.title}
              fit="contain"
              className="aspect-square w-full rounded-none p-8 sm:p-12"
            />
            {badge ? (
              <div className="absolute left-4 top-4">
                <ProductBadge
                  kind={badge}
                  label={badge === "discount" && discountLabel ? discountLabel : undefined}
                />
              </div>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {product.brand || product.category.name}
            </p>
            <h1 className="mt-2 text-page-title">{product.title}</h1>
            {note ? <p className="mt-3 text-sm font-medium text-foreground/80">{note}</p> : null}

            <div className="mt-5">
              <RadarScore rating={product.rating} count={product.ratingCount} />
            </div>

            {showPrice ? (
              <div className="mt-6 flex flex-wrap items-baseline gap-3">
                <span className="text-price text-3xl tracking-tight">
                  {formatCurrency(product.displayPrice, product.currency)}
                </span>
                {product.originalPrice ? (
                  <span className="text-lg font-medium text-muted-foreground line-through">
                    {formatCurrency(product.originalPrice, product.currency)}
                  </span>
                ) : null}
                {discount ? <span className="text-sm font-medium text-muted-foreground">{discount}% off</span> : null}
              </div>
            ) : (
              <p className="mt-6 text-base font-medium text-muted-foreground">Price shown on the retailer&apos;s site</p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Reference price only — always confirm on the marketplace before you buy.
            </p>

            {product.shortDescription ? (
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {product.shortDescription}
              </p>
            ) : null}

            <div className="mt-8 border-t border-border pt-6">
              <h2 className="text-sm font-semibold">Check current price</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {product.marketplaces.length > 0 ? (
                  product.marketplaces.map((link, index) => (
                    <AffiliateCtaButton
                      key={link.marketplace}
                      link={link}
                      variant={index === 0 ? "default" : "outline"}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No marketplace links yet.</p>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                We may earn a commission if you make a purchase through these links, at no extra cost to
                you. See our{" "}
                <Link href="/disclosure" className="font-medium underline underline-offset-2 hover:text-foreground">
                  affiliate disclosure
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {product.longDescription ? (
          <div className="mt-16 max-w-3xl border-t border-border pt-12">
            <p className="text-eyebrow">On the radar</p>
            <h2 className="text-section mt-2">Why it&apos;s on our radar</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
              {product.longDescription}
            </p>
          </div>
        ) : null}
      </Container>

      {related.length > 0 ? (
        <div className="mt-8">
          <ProductCollection
            id="related"
            eyebrow="Keep exploring"
            title="More finds like this"
            description={`One of our favorite aisles: ${product.category.name}.`}
            href={`/categories/${product.category.slug}`}
            products={related}
            tone="muted"
          />
        </div>
      ) : null}
    </div>
  );
}
