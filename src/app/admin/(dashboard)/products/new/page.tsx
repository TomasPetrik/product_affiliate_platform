import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { listCategoriesForSelect, listMarketplaces } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "New product",
};

export default async function NewProductPage() {
  const [categories, marketplaces] = await Promise.all([listCategoriesForSelect(), listMarketplaces()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New product</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a product and its affiliate links.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/products/import/ebay" />}>
          Import from eBay
        </Button>
      </div>
      <ProductForm
        categories={categories}
        marketplaces={marketplaces}
        amazonAssociatesTag={env.AMAZON_ASSOCIATES_TAG ?? null}
      />
    </div>
  );
}
