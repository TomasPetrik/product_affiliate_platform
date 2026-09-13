import type { Metadata } from "next";

import { CategoryForm } from "@/components/admin/category-form";

export const metadata: Metadata = {
  title: "New category",
};

export default function NewCategoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New category</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a new category to organize products.</p>
      </div>
      <CategoryForm />
    </div>
  );
}
