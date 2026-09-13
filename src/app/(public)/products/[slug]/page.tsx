import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductPageView } from "@/components/public/product-page-view";
import { getAllProducts, getProductBySlug, getRelatedProducts } from "@/server/services/catalog.service";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const title = product.seoTitle || product.title;
  const description = product.seoDescription || product.shortDescription;
  const image = product.ogImageUrl || product.imageUrl;

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/products/${product.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const related = await getRelatedProducts(product);

  return <ProductPageView product={product} related={related} />;
}
