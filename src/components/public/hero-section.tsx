import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CompactProductCard } from "@/components/public/product-card";
import { Container } from "@/components/public/container";
import { PRODUCT_COLLECTIONS } from "@/lib/collections";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/brand";
import type { ProductSummary } from "@/types/catalog";

const HERO_LINKS = [
  PRODUCT_COLLECTIONS.trending,
  PRODUCT_COLLECTIONS.featured,
  PRODUCT_COLLECTIONS.under50,
] as const;

interface HeroSectionProps {
  products?: ProductSummary[];
}

export function HeroSection({ products = [] }: HeroSectionProps) {
  const hasProducts = products.length > 0;

  return (
    <section className="border-b border-border bg-card">
      <Container className="py-8 sm:py-9 lg:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-xl">
            <p className="text-eyebrow">Product discovery</p>
            <h1 className="text-hero mt-3 text-[clamp(2rem,4.5vw,3.15rem)]">{SITE_TAGLINE}</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{SITE_DESCRIPTION}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Button nativeButton={false} render={<Link href="/products" />} size="cta">
              Explore collections
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={PRODUCT_COLLECTIONS.featured.href} />}
              size="cta"
              variant="outline"
            >
              See Best Picks
            </Button>
          </div>
        </div>

        <nav aria-label="Featured collections" className="mt-5 flex flex-wrap gap-2">
          {HERO_LINKS.map((collection) => (
            <Link
              key={collection.key}
              href={collection.href}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {collection.shortTitle}
            </Link>
          ))}
        </nav>

        {hasProducts ? (
          <div className="mt-8">
            <p className="mb-3 text-eyebrow">Top products</p>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 lg:grid-cols-4">
              {products.map((product) => (
                <CompactProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
