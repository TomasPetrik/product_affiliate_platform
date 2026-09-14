import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CompactProductCard } from "@/components/public/product-card";
import { Container } from "@/components/public/container";
import { PRODUCT_COLLECTIONS } from "@/lib/collections";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/brand";
import type { ProductSummary } from "@/types/catalog";

interface HeroSectionProps {
  products?: ProductSummary[];
}

export function HeroSection({ products = [] }: HeroSectionProps) {
  const hasProducts = products.length > 0;

  return (
    <section className="border-b border-border">
      <Container className="py-10 sm:py-12 lg:py-14">
        <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0 max-w-3xl">
              <p className="text-eyebrow">Product discovery</p>
              <h1 className="text-hero mt-3 max-w-[10.5ch] sm:max-w-none">{SITE_TAGLINE}</h1>
              <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere] sm:text-base">
                {SITE_DESCRIPTION}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                nativeButton={false}
                render={<Link href={PRODUCT_COLLECTIONS.trending.href} />}
                size="cta"
                className="w-full sm:w-auto"
              >
                Explore Trending
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                nativeButton={false}
                render={<Link href={PRODUCT_COLLECTIONS.featured.href} />}
                size="cta"
                variant="outline"
                className="w-full sm:w-auto"
              >
                See Best Picks
              </Button>
            </div>
          </div>

          {hasProducts ? (
            <div className="grid min-w-0 grid-cols-2 items-stretch gap-3 sm:gap-4 lg:grid-cols-4">
              {products.slice(0, 4).map((product) => (
                <CompactProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
