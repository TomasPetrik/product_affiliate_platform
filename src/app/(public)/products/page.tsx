import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/public/container";
import { PageHeader } from "@/components/public/page-header";
import { ProductGrid } from "@/components/public/product-grid";
import { listingCopy, PRODUCT_COLLECTIONS, type ProductListingFilters } from "@/lib/collections";
import {
  getAllCategories,
  getAllProducts,
  getProductsByCategorySlug,
  searchProducts,
} from "@/server/services/catalog.service";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    featured?: string;
    trending?: string;
    bestsellers?: string;
    new?: string;
    maxPrice?: string;
  }>;
}

function parseFilters(params: Awaited<ProductsPageProps["searchParams"]>): ProductListingFilters {
  const maxPriceRaw = params.maxPrice ? Number(params.maxPrice) : undefined;
  const maxPrice = maxPriceRaw && Number.isFinite(maxPriceRaw) ? maxPriceRaw : undefined;

  return {
    query: params.q?.trim() ?? "",
    categorySlug: params.category ?? "",
    featured: params.featured === "1",
    trending: params.trending === "1",
    bestsellers: params.bestsellers === "1",
    newest: params.new === "1",
    maxPrice,
  };
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const filters = parseFilters(await searchParams);
  const { title, description } = listingCopy(filters);
  return { title, description };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const query = filters.query ?? "";
  const categorySlug = filters.categorySlug ?? "";

  let products: ProductSummary[] = query ? await searchProducts(query) : await getAllProducts();

  if (categorySlug) {
    const categoryProducts = await getProductsByCategorySlug(categorySlug);
    const categoryProductIds = new Set(categoryProducts.map((product) => product.id));
    products = products.filter((product) => categoryProductIds.has(product.id));
  }

  if (filters.featured) {
    products = products.filter((product) => product.isFeatured);
  }

  if (filters.trending) {
    products = products.filter((product) => product.isTrending);
  }

  if (filters.maxPrice) {
    products = products.filter((product) => product.displayPrice > 0 && product.displayPrice <= filters.maxPrice!);
  }

  if (filters.bestsellers) {
    products = [...products].sort((a, b) => b.ratingCount - a.ratingCount || b.rating - a.rating);
  }

  if (filters.newest) {
    products = [...products].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  const categories = await getAllCategories();
  const activeCategory = categories.find((category) => category.slug === categorySlug);
  const copy = listingCopy(filters, activeCategory?.name);

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        title={copy.title}
        description={`${products.length} ${products.length === 1 ? "product" : "products"}${activeCategory && !filters.query ? ` in ${activeCategory.name}` : ""}. ${copy.description}`}
        actions={
          <CategoryFilter
            categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
            activeSlug={categorySlug}
            filters={filters}
          />
        }
      />

      <CollectionFilters filters={filters} />

      <div className="mt-8">
        <ProductGrid products={products} emptyMessage="No products match your filters yet." />
      </div>
    </Container>
  );
}

const COLLECTION_CHIPS = [
  { href: "/products", label: "All", match: (filters: ProductListingFilters) => !isCollectionFilter(filters) },
  {
    href: PRODUCT_COLLECTIONS.trending.href,
    label: PRODUCT_COLLECTIONS.trending.shortTitle,
    match: (filters: ProductListingFilters) => Boolean(filters.trending),
  },
  {
    href: PRODUCT_COLLECTIONS.featured.href,
    label: PRODUCT_COLLECTIONS.featured.shortTitle,
    match: (filters: ProductListingFilters) => Boolean(filters.featured),
  },
  {
    href: PRODUCT_COLLECTIONS.bestsellers.href,
    label: PRODUCT_COLLECTIONS.bestsellers.shortTitle,
    match: (filters: ProductListingFilters) => Boolean(filters.bestsellers),
  },
  {
    href: PRODUCT_COLLECTIONS.newest.href,
    label: PRODUCT_COLLECTIONS.newest.shortTitle,
    match: (filters: ProductListingFilters) => Boolean(filters.newest),
  },
  {
    href: PRODUCT_COLLECTIONS.under50.href,
    label: PRODUCT_COLLECTIONS.under50.shortTitle,
    match: (filters: ProductListingFilters) => filters.maxPrice === 50,
  },
  {
    href: PRODUCT_COLLECTIONS.under100.href,
    label: PRODUCT_COLLECTIONS.under100.shortTitle,
    match: (filters: ProductListingFilters) => filters.maxPrice === 100,
  },
] as const;

function isCollectionFilter(filters: ProductListingFilters): boolean {
  return Boolean(
    filters.featured || filters.trending || filters.bestsellers || filters.newest || filters.maxPrice,
  );
}

function CollectionFilters({ filters }: { filters: ProductListingFilters }) {
  return (
    <nav aria-label="Collections" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {COLLECTION_CHIPS.map((chip) => {
          const active = chip.match(filters);
          return (
            <li key={chip.href}>
              <Link
                href={chip.href}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/70 hover:border-foreground/30 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {chip.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function CategoryFilter({
  categories,
  activeSlug,
  filters,
}: {
  categories: Array<{ slug: string; name: string }>;
  activeSlug: string;
  filters: ProductListingFilters;
}) {
  return (
    <form action="/products" method="get" className="flex items-center gap-2">
      {filters.query ? <input type="hidden" name="q" value={filters.query} /> : null}
      {filters.featured ? <input type="hidden" name="featured" value="1" /> : null}
      {filters.trending ? <input type="hidden" name="trending" value="1" /> : null}
      {filters.bestsellers ? <input type="hidden" name="bestsellers" value="1" /> : null}
      {filters.newest ? <input type="hidden" name="new" value="1" /> : null}
      {filters.maxPrice ? <input type="hidden" name="maxPrice" value={String(filters.maxPrice)} /> : null}
      <select
        name="category"
        defaultValue={activeSlug}
        className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.slug} value={category.slug}>
            {category.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" className="h-10 px-3">
        Apply
      </Button>
    </form>
  );
}
