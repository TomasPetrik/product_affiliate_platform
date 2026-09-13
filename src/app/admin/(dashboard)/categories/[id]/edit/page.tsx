import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/admin/category-form";
import { getCategoryById } from "@/server/services/category.service";

export const metadata: Metadata = {
  title: "Edit category",
};

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;
  const category = await getCategoryById(id);

  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit category</h1>
        <p className="mt-1 text-sm text-muted-foreground">{category.name}</p>
      </div>
      <CategoryForm
        defaultValues={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          isActive: category.isActive,
          sortOrder: category.sortOrder,
        }}
      />
    </div>
  );
}
