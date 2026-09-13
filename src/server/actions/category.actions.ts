"use server";

import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  isCategorySlugTaken,
  updateCategory,
} from "@/server/services/category.service";
import { revalidatePublicCatalog } from "@/server/services/revalidate";
import { categorySchema } from "@/server/validations/category.schema";

export interface CategoryActionState {
  error?: string;
}

export async function saveCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const session = await requireAdminSession();

  const categoryIdRaw = formData.get("categoryId");
  const categoryId = typeof categoryIdRaw === "string" && categoryIdRaw.length > 0 ? categoryIdRaw : null;

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const slugTaken = await isCategorySlugTaken(parsed.data.slug, categoryId ?? undefined);
  if (slugTaken) {
    return { error: `Slug "${parsed.data.slug}" is already in use by another category.` };
  }

  const data = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  };

  if (categoryId) {
    const before = await getCategoryById(categoryId);
    const after = await updateCategory(categoryId, data);
    await writeAuditLog({
      actor: session,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: categoryId,
      before,
      after,
    });
  } else {
    const created = await createCategory(data);
    await writeAuditLog({
      actor: session,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: created.id,
      after: created,
    });
  }

  revalidatePublicCatalog();
  redirect("/admin/categories");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const id = formData.get("categoryId");

  if (typeof id !== "string" || !id) {
    return;
  }

  const before = await getCategoryById(id);
  await deleteCategory(id);

  await writeAuditLog({
    actor: session,
    action: "CATEGORY_DELETED",
    entityType: "Category",
    entityId: id,
    before,
  });

  revalidatePublicCatalog();
  redirect("/admin/categories");
}
