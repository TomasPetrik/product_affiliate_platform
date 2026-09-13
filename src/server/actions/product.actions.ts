"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ProductStatus } from "@/generated/prisma/enums";
import { safeAdminProductsReturnTo, withAdminNotice } from "@/lib/admin-notice";
import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { listUploadedImageFiles, storeUploadedProductImage } from "@/server/services/product-image.service";
import {
  bulkSetProductStatus,
  deleteProduct as deleteProductService,
  getProductByIdAdmin,
  isProductSlugTaken,
  listMarketplaces,
  saveProduct,
  setProductFlag,
  setProductStatus,
} from "@/server/services/product.service";
import { revalidatePublicCatalog, revalidateProductPage } from "@/server/services/revalidate";
import { affiliateLinkSchema, productImageSchema, productSchema } from "@/server/validations/product.schema";

export interface ProductActionState {
  error?: string;
}

const BULK_LIMIT = 100;

function revalidateAdminProducts(): void {
  revalidatePath("/admin/products");
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
    displayPrice: formData.get("displayPrice") || "0",
    originalPrice: formData.get("originalPrice") || undefined,
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    ogImageUrl: formData.get("ogImageUrl") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const slugTaken = await isProductSlugTaken(parsed.data.slug, productId ?? undefined);
  if (slugTaken) {
    return { error: `Slug "${parsed.data.slug}" is already in use by another product.` };
  }

  const marketplaces = await listMarketplaces();
  const primaryMarketplaceId = String(formData.get("primaryMarketplaceId") ?? "");
  const links = [];

  for (const marketplace of marketplaces) {
    const candidate = {
      marketplaceId: marketplace.id,
      affiliateUrl: String(formData.get(`link_${marketplace.id}_affiliateUrl`) ?? ""),
      rawProductUrl: String(formData.get(`link_${marketplace.id}_rawProductUrl`) ?? ""),
      externalProductId: String(formData.get(`link_${marketplace.id}_externalProductId`) ?? ""),
      trackingTag: String(formData.get(`link_${marketplace.id}_trackingTag`) ?? ""),
      isActive: formData.get(`link_${marketplace.id}_isActive`) === "on",
    };

    const linkParsed = affiliateLinkSchema.safeParse(candidate);
    if (!linkParsed.success) {
      return { error: `${marketplace.name}: ${linkParsed.error.issues[0]?.message ?? "Invalid affiliate link."}` };
    }

    links.push({
      marketplaceId: marketplace.id,
      marketplaceCode: marketplace.code,
      affiliateUrl: linkParsed.data.affiliateUrl ?? "",
      rawProductUrl: linkParsed.data.rawProductUrl ?? "",
      externalProductId: linkParsed.data.externalProductId ?? "",
      trackingTag: linkParsed.data.trackingTag || null,
      isActive: linkParsed.data.isActive,
      isPrimary: marketplace.id === primaryMarketplaceId,
    });
  }

  if (!links.some((link) => link.isPrimary && link.affiliateUrl.trim())) {
    const firstWithUrl = links.find((link) => link.affiliateUrl.trim());
    if (firstWithUrl) {
      firstWithUrl.isPrimary = true;
    }
  }

  const urls = formData.getAll("imageUrl");
  const alts = formData.getAll("imageAlt");
  const primaryIndexRaw = formData.get("imagePrimary");
  const primaryIndex = typeof primaryIndexRaw === "string" ? Number.parseInt(primaryIndexRaw, 10) : 0;

  const images: Array<{ url: string; altText: string; isPrimary: boolean }> = [];

  for (let index = 0; index < urls.length; index += 1) {
    const url = String(urls[index] ?? "").trim();
    if (!url) {
      continue;
    }

    const imageParsed = productImageSchema.safeParse({
      url,
      altText: String(alts[index] ?? ""),
      isPrimary: index === primaryIndex,
    });

    if (!imageParsed.success) {
      return { error: imageParsed.error.issues[0]?.message ?? "Invalid image." };
    }

    images.push({
      url: imageParsed.data.url,
      altText: imageParsed.data.altText ?? "",
      isPrimary: imageParsed.data.isPrimary,
    });
  }

  for (const file of listUploadedImageFiles(formData)) {
    const stored = await storeUploadedProductImage(file);
    if ("error" in stored) {
      return { error: stored.error };
    }
    images.push({
      url: stored.url,
      altText: file.name.replace(/\.[^.]+$/, ""),
      isPrimary: images.length === 0,
    });
  }

  const primaryImage = images.find((image) => image.isPrimary) ?? images[0];
  const fields = {
    title: parsed.data.title,
    slug: parsed.data.slug,
    brand: parsed.data.brand,
    categoryId: parsed.data.categoryId,
    shortDescription: parsed.data.shortDescription,
    longDescription: parsed.data.longDescription,
    status: parsed.data.status,
    isFeatured: parsed.data.isFeatured,
    isTrending: parsed.data.isTrending,
    currency: parsed.data.currency,
    displayPrice: parsed.data.displayPrice,
    originalPrice: parsed.data.originalPrice ?? null,
    seoTitle: parsed.data.seoTitle || null,
    seoDescription: parsed.data.seoDescription || null,
    ogImageUrl: parsed.data.ogImageUrl || primaryImage?.url || null,
  };

  const before = productId ? await getProductByIdAdmin(productId) : null;

  let saved;
  try {
    saved = await saveProduct(productId, fields, links, images, session.sub);
  } catch {
    return { error: "Could not save the product. Check your inputs and try again." };
  }

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
  revalidateAdminProducts();
  if (before && before.slug !== saved.slug) {
    revalidateProductPage(before.slug);
  }

  redirect(withAdminNotice("/admin/products", productId ? "updated" : "created"));
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const id = formData.get("productId");

  if (typeof id !== "string" || !id) {
    return;
  }

  const returnTo = safeAdminProductsReturnTo(formData.get("returnTo"));
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
  revalidateAdminProducts();
  if (before) {
    revalidateProductPage(before.slug);
  }
  redirect(withAdminNotice(returnTo, "deleted"));
}

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const id = formData.get("productId");
  const status = formData.get("status");

  if (typeof id !== "string" || !id || (status !== "PUBLISHED" && status !== "DRAFT" && status !== "ARCHIVED")) {
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
  revalidateAdminProducts();
}

export async function bulkSetProductStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const status = formData.get("status");
  const ids = formData
    .getAll("productIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .slice(0, BULK_LIMIT);
  const returnTo = safeAdminProductsReturnTo(formData.get("returnTo"));

  if (ids.length === 0 || (status !== "PUBLISHED" && status !== "DRAFT")) {
    redirect(returnTo);
  }

  const updated = await bulkSetProductStatus(ids, status);

  await writeAuditLog({
    actor: session,
    action: status === "PUBLISHED" ? "PRODUCTS_BULK_PUBLISHED" : "PRODUCTS_BULK_UNPUBLISHED",
    entityType: "Product",
    entityId: ids[0],
    after: { ids, status, count: updated.length },
  });

  revalidatePublicCatalog();
  revalidateAdminProducts();
  for (const product of updated) {
    revalidateProductPage(product.slug);
  }

  redirect(
    withAdminNotice(returnTo, status === "PUBLISHED" ? "bulk-published" : "bulk-unpublished", {
      count: String(updated.length),
    }),
  );
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
  revalidateAdminProducts();
}
