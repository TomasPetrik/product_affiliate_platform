import { revalidatePath, revalidateTag } from "next/cache";

import { AFFILIATE_REDIRECT_CACHE_TAG } from "@/server/services/affiliate-redirect.service";

/** Call after any category/product mutation so ISR'd public pages pick up the change immediately. */
export function revalidatePublicCatalog(): void {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/categories");
  revalidateTag(AFFILIATE_REDIRECT_CACHE_TAG, { expire: 0 });
}

export function revalidateProductPage(slug: string): void {
  revalidatePath(`/products/${slug}`);
}

export function revalidateCategoryPage(slug: string): void {
  revalidatePath(`/categories/${slug}`);
}

export function revalidateAffiliateRedirectCache(): void {
  revalidateTag(AFFILIATE_REDIRECT_CACHE_TAG, { expire: 0 });
}
