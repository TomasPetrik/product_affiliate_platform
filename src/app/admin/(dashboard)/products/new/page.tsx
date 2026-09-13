import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/product-form";
import { listCategoriesForSelect, listMarketplaces } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "New product",
};

export default async function NewProductPage() {
  const [categories, marketplaces] = await Promise.all([listCategoriesForSelect(), listMarketplaces()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create a product and its affiliate links.</p>
      </div>
      <ProductForm categories={categories} marketplaces={marketplaces} />
    </div>
  );
}
