import type { Metadata } from "next";

import { CategoryCard } from "@/components/public/category-card";
import { Container } from "@/components/public/container";
import { HeroSection } from "@/components/public/hero-section";
import { ProductCollection } from "@/components/public/product-collection";
import { SectionHeading } from "@/components/public/section-heading";
import { SITE_DESCRIPTION } from "@/lib/brand";
import { PRODUCT_COLLECTIONS } from "@/lib/collections";
import {
  getAllCategories,
  getBestSellerProducts,
  getFeaturedProducts,
  getNewProducts,
  getProductsUnderPrice,
  getTrendingProducts,
} from "@/server/services/catalog.service";
import type { ProductSummary } from "@/types/catalog";

function pickUniqueProducts(limit: number, ...groups: ProductSummary[][]): ProductSummary[] {
  const seen = new Set<string>();
  const picked: ProductSummary[] = [];

  for (const group of groups) {
    for (const product of group) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      picked.push(product);
      if (picked.length >= limit) return picked;
    }
  }

  return picked;
}

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
};

export default async function HomePage() {
  const [trending, featured, bestsellers, newest, under50, under100, categories] = await Promise.all([
    getTrendingProducts(8),
    getFeaturedProducts(4),
    getBestSellerProducts(4),
    getNewProducts(4),
    getProductsUnderPrice(50, 4),
    getProductsUnderPrice(100, 4),
    getAllCategories(),
  ]);

  const heroProducts = pickUniqueProducts(4, featured.slice(0, 2), trending, bestsellers, featured);

  return (
    <div className="flex flex-col">
      <HeroSection products={heroProducts} />

      <ProductCollection
        id="trending"
        eyebrow={PRODUCT_COLLECTIONS.trending.eyebrow}
        title={PRODUCT_COLLECTIONS.trending.title}
        description={PRODUCT_COLLECTIONS.trending.description}
        href={PRODUCT_COLLECTIONS.trending.href}
        products={trending}
      />

      <ProductCollection
        id="editors-picks"
        eyebrow={PRODUCT_COLLECTIONS.featured.eyebrow}
        title={PRODUCT_COLLECTIONS.featured.title}
        description={PRODUCT_COLLECTIONS.featured.description}
        href={PRODUCT_COLLECTIONS.featured.href}
        products={featured}
        tone="muted"
        layout="spotlight"
      />

      <ProductCollection
        id="best-sellers"
        eyebrow={PRODUCT_COLLECTIONS.bestsellers.eyebrow}
        title={PRODUCT_COLLECTIONS.bestsellers.title}
        description={PRODUCT_COLLECTIONS.bestsellers.description}
        href={PRODUCT_COLLECTIONS.bestsellers.href}
        products={bestsellers}
      />

      <ProductCollection
        id="new"
        eyebrow={PRODUCT_COLLECTIONS.newest.eyebrow}
        title={PRODUCT_COLLECTIONS.newest.title}
        description={PRODUCT_COLLECTIONS.newest.description}
        href={PRODUCT_COLLECTIONS.newest.href}
        products={newest}
        tone="muted"
      />

      <ProductCollection
        id="under-50"
        eyebrow={PRODUCT_COLLECTIONS.under50.eyebrow}
        title={PRODUCT_COLLECTIONS.under50.title}
        description={PRODUCT_COLLECTIONS.under50.description}
        href={PRODUCT_COLLECTIONS.under50.href}
        products={under50}
      />

      <ProductCollection
        id="under-100"
        eyebrow={PRODUCT_COLLECTIONS.under100.eyebrow}
        title={PRODUCT_COLLECTIONS.under100.title}
        description={PRODUCT_COLLECTIONS.under100.description}
        href={PRODUCT_COLLECTIONS.under100.href}
        products={under100}
        tone="muted"
      />

      {categories.length > 0 ? (
        <section aria-labelledby="categories-heading" className="py-8 sm:py-12">
          <Container>
            <SectionHeading
              id="categories-heading"
              eyebrow="Browse"
              title="Shop by category"
              viewAllHref="/categories"
            />
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </div>
  );
}
