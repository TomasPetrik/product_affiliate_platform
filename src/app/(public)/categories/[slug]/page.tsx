import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Container } from "@/components/public/container";
import { ProductGrid } from "@/components/public/product-grid";
import { getAllCategories, getCategoryBySlug, getProductsByCategorySlug } from "@/server/services/catalog.service";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategorySlug(category.slug);

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/categories" />}>Categories</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mt-8 text-page-title">{category.name}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {category.description}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {products.length} {products.length === 1 ? "find" : "finds"} in this aisle
      </p>

      <div className="mt-10">
        <ProductGrid products={products} emptyMessage="No products in this category yet." />
      </div>
    </Container>
  );
}
