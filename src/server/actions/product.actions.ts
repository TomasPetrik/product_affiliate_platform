"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ProductStatus } from "@/generated/prisma/enums";
import { isApprovedImageUrl } from "@/lib/approved-image-url";
import {
  extractAmazonAscSubtag,
  extractAmazonAsin,
  extractAmazonPartnerTag,
  generateAmazonTrackedAffiliate,
} from "@/lib/amazon-url";
import { safeAdminProductsReturnTo, withAdminNotice } from "@/lib/admin-notice";
import { requireAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/server/services/audit.service";
import { listUploadedImageFiles, storeUploadedProductImage } from "@/server/services/product-image.service";
import {
  bulkDeleteProducts,
  bulkSetProductStatus,
  deleteProduct as deleteProductService,
  getProductByIdAdmin,
  isProductSlugTaken,
  listMarketplaces,
  replaceProductHeroImage,
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
    modelNumber: formData.get("modelNumber") ?? "",
    gtin: formData.get("gtin") ?? "",
    mpn: formData.get("mpn") ?? "",
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
    let affiliateUrl = String(formData.get(`link_${marketplace.id}_affiliateUrl`) ?? "");
    const rawProductUrl = String(formData.get(`link_${marketplace.id}_rawProductUrl`) ?? "");
    let externalProductId = String(formData.get(`link_${marketplace.id}_externalProductId`) ?? "");
    let trackingTag = String(formData.get(`link_${marketplace.id}_trackingTag`) ?? "");

    if (marketplace.code === "AMAZON") {
      if (!externalProductId.trim()) {
        const asin =
          extractAmazonAsin(affiliateUrl) ?? extractAmazonAsin(rawProductUrl) ?? null;
        if (asin) {
          externalProductId = asin;
        }
      }

      const partnerTag = env.AMAZON_ASSOCIATES_TAG?.trim() ?? "";
      // trackingTag is the unique ascsubtag — never the account partner tag.
      if (!trackingTag.trim() || (partnerTag && trackingTag.trim() === partnerTag)) {
        trackingTag = extractAmazonAscSubtag(affiliateUrl) ?? "";
      }

      const hasAmazonInput = Boolean(
        affiliateUrl.trim() || rawProductUrl.trim() || externalProductId.trim(),
      );
      const needsTracking =
        Boolean(partnerTag) &&
        hasAmazonInput &&
        (!extractAmazonPartnerTag(affiliateUrl) ||
          !extractAmazonAscSubtag(affiliateUrl) ||
          !trackingTag.trim());

      if (needsTracking) {
        try {
          const generated = generateAmazonTrackedAffiliate({
            affiliateUrl,
            rawProductUrl,
            asin: externalProductId,
            partnerTag,
            productId,
            customId: trackingTag.trim() || undefined,
          });
          affiliateUrl = generated.affiliateUrl;
          trackingTag = generated.trackingTag;
          if (!externalProductId.trim() && generated.asin) {
            externalProductId = generated.asin;
          }
        } catch (error) {
          return {
            error: `Amazon: ${error instanceof Error ? error.message : "Could not build the affiliate URL."}`,
          };
        }
      }
    }

    const candidate = {
      marketplaceId: marketplace.id,
      affiliateUrl,
      rawProductUrl,
      externalProductId,
      trackingTag,
      lastKnownPrice: formData.get(`link_${marketplace.id}_lastKnownPrice`) ?? "",
      lastKnownOriginalPrice: formData.get(`link_${marketplace.id}_lastKnownOriginalPrice`) ?? "",
      lastKnownPriceCurrency: String(formData.get(`link_${marketplace.id}_lastKnownPriceCurrency`) ?? ""),
      lastKnownAvailability: String(formData.get(`link_${marketplace.id}_lastKnownAvailability`) ?? ""),
      isActive: formData.get(`link_${marketplace.id}_isActive`) === "on",
    };

    const linkParsed = affiliateLinkSchema.safeParse(candidate);
    if (!linkParsed.success) {
      return { error: `${marketplace.name}: ${linkParsed.error.issues[0]?.message ?? "Invalid affiliate link."}` };
    }

    const currency =
      linkParsed.data.lastKnownPriceCurrency?.trim() ||
      (linkParsed.data.lastKnownPrice != null ? parsed.data.currency : null);

    links.push({
      marketplaceId: marketplace.id,
      marketplaceCode: marketplace.code,
      affiliateUrl: linkParsed.data.affiliateUrl ?? "",
      rawProductUrl: linkParsed.data.rawProductUrl ?? "",
      externalProductId: linkParsed.data.externalProductId ?? "",
      trackingTag: linkParsed.data.trackingTag || null,
      lastKnownPrice: linkParsed.data.lastKnownPrice ?? null,
      lastKnownOriginalPrice: linkParsed.data.lastKnownOriginalPrice ?? null,
      lastKnownPriceCurrency: currency,
      lastKnownAvailability: linkParsed.data.lastKnownAvailability || null,
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
    modelNumber: parsed.data.modelNumber || null,
    gtin: parsed.data.gtin || null,
    mpn: parsed.data.mpn || null,
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
  } catch (error) {
    return { error: formatProductSaveError(error) };
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

  // Stay on the edit page so affiliate-link changes are visible after save.
  redirect(withAdminNotice(`/admin/products/${saved.id}/edit`, productId ? "updated" : "created"));
}

function formatProductSaveError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim();
    if (
      message.includes("already linked") ||
      message.includes("Affiliate URL") ||
      message.includes("listing")
    ) {
      return message;
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return "That retailer listing ID is already used by another product.";
  }

  console.error("saveProductAction failed", error);
  return "Could not save the product. Check the Amazon/eBay fields and try again.";
}

export async function replaceHeroImageAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const session = await requireAdminSession();
  const productId = formData.get("productId");

  if (typeof productId !== "string" || !productId) {
    return { error: "Missing product." };
  }

  const before = await getProductByIdAdmin(productId);
  if (!before) {
    return { error: "Product not found." };
  }

  const uploaded = listUploadedImageFiles(formData)[0];
  const imageUrlRaw = String(formData.get("heroImageUrl") ?? "").trim();
  const altText = String(formData.get("heroImageAlt") ?? "").trim() || before.title;

  let url = "";
  if (uploaded) {
    const stored = await storeUploadedProductImage(uploaded);
    if ("error" in stored) {
      return { error: stored.error };
    }
    url = stored.url;
  } else if (imageUrlRaw) {
    if (!isApprovedImageUrl(imageUrlRaw)) {
      return { error: "Hero image must be an https URL or an uploaded file." };
    }
    url = imageUrlRaw;
  } else {
    return { error: "Upload a file or paste an https image URL." };
  }

  let updated;
  try {
    updated = await replaceProductHeroImage(productId, { url, altText });
  } catch {
    return { error: "Could not update the hero image. Try again." };
  }

  await writeAuditLog({
    actor: session,
    action: "PRODUCT_HERO_IMAGE_REPLACED",
    entityType: "Product",
    entityId: productId,
    before: { ogImageUrl: before.ogImageUrl, primaryImage: before.images.find((image) => image.isPrimary)?.url },
    after: { ogImageUrl: updated.ogImageUrl, primaryImage: url },
  });

  revalidatePublicCatalog();
  revalidateProductPage(updated.slug);
  revalidateAdminProducts();
  revalidatePath(`/admin/products/${productId}/edit`);

  redirect(withAdminNotice(`/admin/products/${productId}/edit`, "hero-updated"));
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

export async function bulkDeleteProductsAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const ids = formData
    .getAll("productIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .slice(0, BULK_LIMIT);
  const returnTo = safeAdminProductsReturnTo(formData.get("returnTo"));

  if (ids.length === 0) {
    redirect(returnTo);
  }

  const deleted = await bulkDeleteProducts(ids);

  await writeAuditLog({
    actor: session,
    action: "PRODUCTS_BULK_DELETED",
    entityType: "Product",
    entityId: ids[0],
    after: { ids, count: deleted.count },
  });

  revalidatePublicCatalog();
  revalidateAdminProducts();
  for (const slug of deleted.slugs) {
    revalidateProductPage(slug);
  }

  redirect(withAdminNotice(returnTo, "bulk-deleted", { count: String(deleted.count) }));
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
