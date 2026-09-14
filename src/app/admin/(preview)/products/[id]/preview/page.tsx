import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductPageView } from "@/components/public/product-page-view";
import { Container } from "@/components/public/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRelatedProducts } from "@/server/services/catalog.service";
import { getProductPreviewById } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Preview product",
  robots: { index: false, follow: false },
};

interface ProductPreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPreviewPage({ params }: ProductPreviewPageProps) {
  const { id } = await params;
  const product = await getProductPreviewById(id);

  if (!product) {
    notFound();
  }

  const related = product.status === "PUBLISHED" ? await getRelatedProducts(product) : [];

  return (
    <>
      <div className="border-b border-border bg-muted/70">
        <Container className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{product.status}</Badge>
            <p className="font-medium">Admin preview</p>
            {product.status !== "PUBLISHED" ? (
              <p className="text-muted-foreground">This product is hidden from the public site.</p>
            ) : (
              <p className="text-muted-foreground">This is how the live product page looks.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/products/${id}/edit`} />}>
              Edit
            </Button>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/products" />}>
              Back to products
            </Button>
            {product.status === "PUBLISHED" ? (
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href={`/products/${product.slug}`} target="_blank" />}
              >
                View live
              </Button>
            ) : null}
          </div>
        </Container>
      </div>
      <ProductPageView product={product} related={related} trackViews={false} />
    </>
  );
}
