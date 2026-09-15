import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminFlash } from "@/components/admin/admin-flash";
import { ProductFilters } from "@/components/admin/product-filters";
import { ProductPagination } from "@/components/admin/product-pagination";
import { ProductTable } from "@/components/admin/product-table";
import { Button } from "@/components/ui/button";
import { adminNoticeMessage } from "@/lib/admin-notice";
import { parseProductAdminQuery, productListHref } from "@/lib/product-admin-query";
import {
  listCategoriesForSelect,
  listMarketplaces,
  queryProductsAdmin,
} from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Products",
};

export const dynamic = "force-dynamic";

interface AdminProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  const query = parseProductAdminQuery(params);
  const [{ products, total, pageCount }, categories, marketplaces] = await Promise.all([
    queryProductsAdmin(query),
    listCategoriesForSelect(),
    listMarketplaces(),
  ]);

  const notice = adminNoticeMessage(
    typeof params.notice === "string" ? params.notice : undefined,
    typeof params.count === "string" ? params.count : undefined,
  );
  const error = typeof params.error === "string" ? params.error : undefined;
  const returnTo = productListHref(query);

  return (
    <div className="flex flex-col gap-6">
      <AdminFlash notice={notice} error={error} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"}
            {query.q ? ` matching “${query.q}”` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/products/import/ebay" />}>
            Import from eBay
          </Button>
          <Button render={<Link href="/admin/products/new" />} nativeButton={false} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>
      </div>

      <ProductFilters query={query} categories={categories} marketplaces={marketplaces} />

      <ProductTable products={products} query={query} returnTo={returnTo} />

      <ProductPagination query={query} total={total} pageCount={pageCount} />
    </div>
  );
}
