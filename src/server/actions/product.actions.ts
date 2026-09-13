"use server";

import { redirect } from "next/navigation";

import type { ProductStatus } from "@/generated/prisma/enums";
import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteProduct as deleteProductService,
  getProductByIdAdmin,
  isProductSlugTaken,
  listMarketplaces,
  saveProduct,
  setProductFlag,
  setProductStatus,
} from "@/server/services/product.service";
import { revalidatePublicCatalog, revalidateProductPage } from "@/server/services/revalidate";
import { productSchema } from "@/server/validations/product.schema";

export interface ProductActionState {
  error?: string;
}

export async function saveProductAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const session = await requireAdminSession();

  const productIdRaw = formData.get("productId");
  const productId = typeof productIdRaw === "string" && productIdRaw.length > 0 ? productIdRaw : null;

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    brand: formData.get("brand") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    shortDescription: formData.get("shortDescription") ?? "",
    longDescription: formData.get("longDescription") ?? "",
    status: formData.get("status"),
    isFeatured: formData.get("isFeatured") === "on",
    isTrending: formData.get("isTrending") === "on",
    currency: formData.get("currency") || "USD",
    displayPrice: formData.get("displayPrice") || undefined,
    originalPrice: formData.get("originalPrice") || undefined,
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const slugTaken = await isProductSlugTaken(parsed.data.slug, productId ?? undefined);
  if (slugTaken) {
    return { error: `Slug "${parsed.data.slug}" is already in use by another product.` };
  }

  const marketplaces = await listMarketplaces();
  const links = marketplaces.map((marketplace) => ({
    marketplaceId: marketplace.id,
    marketplaceCode: marketplace.code,
    affiliateUrl: String(formData.get(`link_${marketplace.id}_affiliateUrl`) ?? ""),
    rawProductUrl: String(formData.get(`link_${marketplace.id}_rawProductUrl`) ?? ""),
    externalProductId: String(formData.get(`link_${marketplace.id}_externalProductId`) ?? ""),
    trackingTag: String(formData.get(`link_${marketplace.id}_trackingTag`) ?? ""),
    isActive: formData.get(`link_${marketplace.id}_isActive`) === "on",
  }));

  const fields = {
    title: parsed.data.title,
    slug: parsed.data.slug,
    brand: parsed.data.brand || null,
    categoryId: parsed.data.categoryId || null,
    shortDescription: parsed.data.shortDescription || null,
    longDescription: parsed.data.longDescription || null,
    status: parsed.data.status,
    isFeatured: parsed.data.isFeatured,
    isTrending: parsed.data.isTrending,
    currency: parsed.data.currency,
    displayPrice: parsed.data.displayPrice ?? null,
    originalPrice: parsed.data.originalPrice ?? null,
    seoTitle: parsed.data.seoTitle || null,
    seoDescription: parsed.data.seoDescription || null,
  };

  const before = productId ? await getProductByIdAdmin(productId) : null;
  const saved = await saveProduct(productId, fields, links, session.sub);

  await writeAuditLog({
    actor: session,
    action: productId ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
    entityType: "Product",
    entityId: saved.id,
    before,
    after: saved,
  });

  revalidatePublicCatalog();
  revalidateProductPage(saved.slug);
  if (before && before.slug !== saved.slug) {
    revalidateProductPage(before.slug);
  }

  redirect("/admin/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const id = formData.get("productId");

  if (typeof id !== "string" || !id) {
    return;
  }

  const before = await getProductByIdAdmin(id);
  await deleteProductService(id);

  await writeAuditLog({
    actor: session,
    action: "PRODUCT_DELETED",
    entityType: "Product",
    entityId: id,
    before,
  });

  revalidatePublicCatalog();
  if (before) {
    revalidateProductPage(before.slug);
  }
  redirect("/admin/products");
}

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const id = formData.get("productId");
  const status = formData.get("status");

  if (typeof id !== "string" || !id || typeof status !== "string") {
    return;
  }

  const before = await getProductByIdAdmin(id);
  const updated = await setProductStatus(id, status as ProductStatus);

  await writeAuditLog({
    actor: session,
    action: status === "PUBLISHED" ? "PRODUCT_PUBLISHED" : "PRODUCT_UNPUBLISHED",
    entityType: "Product",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePublicCatalog();
  revalidateProductPage(updated.slug);
}

export async function toggleProductFlagAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const id = formData.get("productId");
  const flag = formData.get("flag");
  const value = formData.get("value") === "true";

  if (typeof id !== "string" || !id || (flag !== "isFeatured" && flag !== "isTrending")) {
    return;
  }

  const updated = await setProductFlag(id, flag, value);

  await writeAuditLog({
    actor: session,
    action: flag === "isFeatured" ? "PRODUCT_FEATURED_TOGGLED" : "PRODUCT_TRENDING_TOGGLED",
    entityType: "Product",
    entityId: id,
    after: { [flag]: value },
  });

  revalidatePublicCatalog();
  revalidateProductPage(updated.slug);
}
