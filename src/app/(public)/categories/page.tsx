import type { Metadata } from "next";

import { CategoryCard } from "@/components/public/category-card";
import { getAllCategories } from "@/lib/placeholder-data";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse curated products organized by category.",
};

export default function CategoriesPage() {
  const categories = getAllCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {categories.length} categories, updated as new products are added.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
