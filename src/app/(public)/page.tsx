import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/public/section-heading";
import { ProductGrid } from "@/components/public/product-grid";
import { CategoryCard } from "@/components/public/category-card";
import { SearchBar } from "@/components/public/search-bar";
import {
  getAllCategories,
  getFeaturedProducts,
  getTrendingProducts,
} from "@/server/services/catalog.service";

export const metadata: Metadata = {
  title: "Discover trending & featured products",
  description:
    "Browse hand-picked, trending and featured products from Amazon, eBay and other marketplaces — then buy directly from the retailer you trust.",
};

export default async function HomePage() {
  const [trending, featured, categories] = await Promise.all([
    getTrendingProducts(),
    getFeaturedProducts(),
    getAllCategories(),
  ]);

  return (
    <div className="flex flex-col gap-16 pb-16">
      <section className="border-b bg-gradient-to-b from-muted/60 to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Discover the best products, <span className="text-primary">buy where you trust</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground sm:text-lg">
            We research and curate products from Amazon, eBay and other marketplaces so you can
            decide fast — every purchase happens directly on the retailer&apos;s site.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <SearchBar />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/products" />} nativeButton={false} size="lg">
              Browse all products
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button render={<Link href="/categories" />} nativeButton={false} size="lg" variant="outline">
              Explore categories
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="Trending now"
          description="Popular with readers this week"
          viewAllHref="/products?trending=1"
        />
        <div className="mt-6">
          <ProductGrid products={trending} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading
          title="Featured picks"
          description="Our editors' top recommendations"
          viewAllHref="/products?featured=1"
        />
        <div className="mt-6">
          <ProductGrid products={featured} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <SectionHeading title="Shop by category" viewAllHref="/categories" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </div>
  );
}
