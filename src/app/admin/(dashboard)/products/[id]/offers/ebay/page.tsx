import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EbayImportForm } from "@/components/admin/ebay-import-form";
import { env } from "@/lib/env";
import { getProductByIdAdmin, listCategoriesForSelect } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Add eBay offer",
};

interface AddEbayOfferPageProps {
  params: Promise<{ id: string }>;
}

export default async function AddEbayOfferPage({ params }: AddEbayOfferPageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductByIdAdmin(id), listCategoriesForSelect()]);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add eBay offer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach an eBay listing to <span className="font-medium text-foreground">{product.title}</span>. The
          RadarCut product stays the same; only a retailer offer is added.
        </p>
      </div>
      <EbayImportForm
        categories={categories}
        attachProductId={product.id}
        attachProductTitle={product.title}
        sandbox={env.EBAY_ENVIRONMENT === "sandbox"}
      />
    </div>
  );
}
