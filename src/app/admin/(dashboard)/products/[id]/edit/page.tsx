import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm, type ProductFormLinkValues } from "@/components/admin/product-form";
import {
  getProductByIdAdmin,
  listCategoriesForSelect,
  listMarketplaces,
} from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Edit product",
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [product, categories, marketplaces] = await Promise.all([
    getProductByIdAdmin(id),
    listCategoriesForSelect(),
    listMarketplaces(),
  ]);

  if (!product) {
    notFound();
  }

  const links: Record<string, ProductFormLinkValues> = {};
  for (const link of product.affiliateLinks) {
    links[link.marketplaceId] = {
      affiliateUrl: link.affiliateUrl,
      rawProductUrl: link.rawProductUrl,
      externalProductId: link.externalProductId,
      trackingTag: link.trackingTag ?? "",
      isActive: link.isActive,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
        <p className="mt-1 text-sm text-muted-foreground">{product.title}</p>
      </div>
      <ProductForm
        categories={categories}
        marketplaces={marketplaces}
        defaultValues={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          brand: product.brand ?? "",
          categoryId: product.categoryId ?? "",
          shortDescription: product.shortDescription ?? "",
          longDescription: product.longDescription ?? "",
          status: product.status,
          isFeatured: product.isFeatured,
          isTrending: product.isTrending,
          currency: product.currency,
          displayPrice: product.displayPrice ? String(product.displayPrice) : "",
          originalPrice: product.originalPrice ? String(product.originalPrice) : "",
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          links,
        }}
      />
    </div>
  );
}
