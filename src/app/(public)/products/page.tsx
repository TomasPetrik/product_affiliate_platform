import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/public/product-grid";
import {
  getAllCategories,
  getAllProducts,
  getProductsByCategorySlug,
  searchProducts,
} from "@/lib/placeholder-data";
import type { ProductSummary } from "@/types/catalog";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse every curated product, filterable by category and search term.",
};

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    featured?: string;
    trending?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const categorySlug = params.category ?? "";

  let products: ProductSummary[] = query ? searchProducts(query) : getAllProducts();

  if (categorySlug) {
    const categoryProducts = getProductsByCategorySlug(categorySlug);
    const categoryProductIds = new Set(categoryProducts.map((product) => product.id));
    products = products.filter((product) => categoryProductIds.has(product.id));
  }

  if (params.featured === "1") {
    products = products.filter((product) => product.isFeatured);
  }

  if (params.trending === "1") {
    products = products.filter((product) => product.isTrending);
  }

  const categories = getAllCategories();
  const activeCategory = categories.find((category) => category.slug === categorySlug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
            {activeCategory ? ` in ${activeCategory.name}` : ""}
            {query ? ` matching “${query}”` : ""}
          </p>
        </div>

        <CategoryFilter categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} activeSlug={categorySlug} />
      </div>

      <div className="mt-8">
        <ProductGrid products={products} emptyMessage="No products match your filters yet." />
      </div>
    </div>
  );
}

function CategoryFilter({
  categories,
  activeSlug,
}: {
  categories: Array<{ slug: string; name: string }>;
  activeSlug: string;
}) {
  // Plain native <select> inside a GET form: filters via the `category`
  // query param without requiring any client-side JavaScript.
  return (
    <form action="/products" method="get" className="flex items-center gap-2">
      <select
        name="category"
        defaultValue={activeSlug}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.slug} value={category.slug}>
            {category.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
