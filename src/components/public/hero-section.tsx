import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/public/container";
import { PRODUCT_COLLECTIONS } from "@/lib/collections";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/brand";

const HERO_LINKS = [
  PRODUCT_COLLECTIONS.trending,
  PRODUCT_COLLECTIONS.featured,
  PRODUCT_COLLECTIONS.under50,
] as const;

export function HeroSection() {
  return (
    <section className="border-b border-border bg-card">
      <Container className="py-14 sm:py-20 lg:py-24">
        <p className="text-eyebrow">Product discovery</p>
        <h1 className="text-hero mt-4 max-w-3xl">{SITE_TAGLINE}</h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {SITE_DESCRIPTION}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
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
        <nav aria-label="Featured collections" className="mt-10 flex flex-wrap gap-x-5 gap-y-2">
          {HERO_LINKS.map((collection) => (
            <Link
              key={collection.key}
              href={collection.href}
              className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {collection.shortTitle}
            </Link>
          ))}
        </nav>
      </Container>
    </section>
  );
}
