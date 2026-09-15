import type { Metadata } from "next";
import Link from "next/link";

import { env } from "@/lib/env";
import { EbayImportForm } from "@/components/admin/ebay-import-form";
import { Button } from "@/components/ui/button";
import { listCategoriesForSelect } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Import from eBay",
};

export default async function ImportFromEbayPage() {
  const categories = await listCategoriesForSelect();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import product from eBay</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fetch a listing with the official eBay Browse API. RadarCut stores a canonical product plus an eBay
            retailer offer.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/products/new" />}>
          Create manually
        </Button>
      </div>
      <EbayImportForm categories={categories} sandbox={env.EBAY_ENVIRONMENT === "sandbox"} />
    </div>
  );
}
