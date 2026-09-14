import type { Metadata } from "next";

import { CategoryCard } from "@/components/public/category-card";
import { Container } from "@/components/public/container";
import { PageHeader } from "@/components/public/page-header";
import { getAllCategories } from "@/server/services/catalog.service";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse by aisle — then wander.",
};

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <Container className="py-12 sm:py-16">
      <PageHeader
        eyebrow="Browse"
        title="Categories"
        description={`${categories.length} places to start looking.`}
      />

      <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </Container>
  );
}
