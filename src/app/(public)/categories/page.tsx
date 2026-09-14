import type { Metadata } from "next";

import { CategoryCard } from "@/components/public/category-card";
import { Container } from "@/components/public/container";
import { PageHeader } from "@/components/public/page-header";
import { getAllCategories } from "@/server/services/catalog.service";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse curated products organized by category.",
};

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Browse"
        title="Categories"
        description={`${categories.length} categories, updated as new products are added.`}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </Container>
  );
}
