import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_PAGE_SIZES, type ProductAdminQuery } from "@/lib/product-admin-query";

interface ProductFiltersProps {
  query: ProductAdminQuery;
  categories: Array<{ id: string; name: string }>;
  marketplaces: Array<{ id: string; name: string }>;
}

export function ProductFilters({ query, categories, marketplaces }: ProductFiltersProps) {
  return (
    <form method="get" action="/admin/products" className="grid gap-3 rounded-xl border p-4 lg:grid-cols-12">
      {query.sort !== "updatedAt" ? <input type="hidden" name="sort" value={query.sort} /> : null}
      {query.dir !== "desc" || query.sort !== "updatedAt" ? <input type="hidden" name="dir" value={query.dir} /> : null}

      <div className="flex flex-col gap-1.5 lg:col-span-4">
        <Label htmlFor="product-search">Search</Label>
        <Input
          id="product-search"
          name="q"
          defaultValue={query.q}
          placeholder="Title, brand, slug, or ASIN…"
        />
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="product-status">Status</Label>
        <select
          id="product-status"
          name="status"
          defaultValue={query.status === "ALL" ? "" : query.status}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">All</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="product-category">Category</Label>
        <select
          id="product-category"
          name="category"
          defaultValue={query.categoryId}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">All</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="product-marketplace">Marketplace</Label>
        <select
          id="product-marketplace"
          name="marketplace"
          defaultValue={query.marketplaceId}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">All</option>
          {marketplaces.map((marketplace) => (
            <option key={marketplace.id} value={marketplace.id}>
              {marketplace.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 lg:col-span-1">
        <Label htmlFor="product-page-size">Per page</Label>
        <select
          id="product-page-size"
          name="pageSize"
          defaultValue={query.pageSize}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          {PRODUCT_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-3 lg:col-span-12">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="featured" value="1" defaultChecked={query.featured} className="size-4" />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="trending" value="1" defaultChecked={query.trending} className="size-4" />
          Trending
        </label>
        <div className="ml-auto flex gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>
          <Button type="button" size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/products" />}>
            Reset
          </Button>
        </div>
      </div>
    </form>
  );
}
