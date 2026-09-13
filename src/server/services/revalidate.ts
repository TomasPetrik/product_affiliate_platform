import { revalidatePath } from "next/cache";

/** Call after any category/product mutation so ISR'd public pages pick up the change immediately. */
export function revalidatePublicCatalog(): void {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/categories");
}

export function revalidateProductPage(slug: string): void {
  revalidatePath(`/products/${slug}`);
}

export function revalidateCategoryPage(slug: string): void {
  revalidatePath(`/categories/${slug}`);
}
