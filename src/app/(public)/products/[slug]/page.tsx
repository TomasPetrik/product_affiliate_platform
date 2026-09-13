import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { AffiliateCtaButton } from "@/components/public/affiliate-cta-button";
import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { ProductGrid } from "@/components/public/product-grid";
import { SectionHeading } from "@/components/public/section-heading";
import { formatCurrency, formatDiscountPercent, formatRating } from "@/lib/format";
import { getAllProducts, getProductBySlug, getRelatedProducts } from "@/lib/placeholder-data";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.title,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.shortDescription,
      type: "website",
      url: `/products/${product.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: product.shortDescription,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const discount = formatDiscountPercent(product.displayPrice, product.originalPrice);
  const related = getRelatedProducts(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    brand: { "@type": "Brand", name: product.brand },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.ratingCount,
    },
    // Offers intentionally omitted: price/availability live on the
    // marketplace, not on this site — see affiliate compliance notes.
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductImagePlaceholder seed={product.slug} className="aspect-square w-full rounded-xl" />

        <div>
          <p className="text-sm font-medium text-muted-foreground">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{product.title}</h1>

          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-medium">{formatRating(product.rating)}</span>
            <span className="text-muted-foreground">({product.ratingCount.toLocaleString()} ratings)</span>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">
              {formatCurrency(product.displayPrice, product.currency)}
            </span>
            {product.originalPrice ? (
              <span className="text-lg text-muted-foreground line-through">
                {formatCurrency(product.originalPrice, product.currency)}
              </span>
            ) : null}
            {discount ? <span className="text-sm font-medium text-emerald-600">Save {discount}%</span> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reference price only — always confirmed on the marketplace before you buy.
          </p>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.shortDescription}</p>

          <Separator className="my-6" />

          <div>
            <h2 className="text-sm font-semibold">Available at</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {product.marketplaces.map((link) => (
                <AffiliateCtaButton key={link.marketplace} link={link} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              We may earn a commission if you make a purchase through these links, at no extra cost
              to you. See our{" "}
              <Link href="/disclosure" className="underline underline-offset-2">
                affiliate disclosure
              </Link>{" "}
              for details.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 max-w-3xl">
        <h2 className="text-lg font-semibold">About this product</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {product.longDescription}
        </p>
      </div>

      {related.length > 0 ? (
        <div className="mt-16">
          <SectionHeading title="You might also like" description={`More from ${product.category.name}`} />
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
