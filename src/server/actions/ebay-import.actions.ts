"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { userFacingEbayMessage } from "@/server/ebay/ebay-errors";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  importEbayListing,
  previewEbayListing,
  searchEbayListings,
  searchProductsForAttach,
} from "@/server/services/ebay-import.service";
import { revalidateProductPage, revalidatePublicCatalog } from "@/server/services/revalidate";
import { ebayFetchSchema, ebayImportSchema, ebaySearchSchema } from "@/server/validations/ebay-import.schema";

export interface EbaySearchHitView {
  itemId: string;
  title: string;
  price: number | null;
  currency: string | null;
  condition: string | null;
  sellerName: string | null;
  imageUrl: string | null;
}

export interface EbayPreviewView {
  itemId: string;
  title: string;
  brand: string;
  modelNumber: string;
  gtin: string;
  mpn: string;
  shortDescription: string;
  description: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  condition: string | null;
  sellerName: string | null;
  imageUrl: string | null;
  additionalImageUrls: string[];
  productUrl: string;
  affiliateUrl: string;
  affiliateReferenceId: string;
  availability: string | null;
  suggestedSlug: string;
  existingOffer: { productId: string; productTitle: string; productSlug: string; offerId: string } | null;
  identifierMatches: Array<{ id: string; title: string; slug: string; brand: string; reason: string }>;
}

export async function searchEbayAction(query: string): Promise<{ hits?: EbaySearchHitView[]; error?: string }> {
  await requireAdminSession();
  const parsed = ebaySearchSchema.safeParse({ query });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  try {
    const hits = await searchEbayListings(parsed.data.query);
    return { hits };
  } catch (error) {
    return { error: userFacingEbayMessage(error) };
  }
}

export async function fetchEbayListingAction(
  source: string,
  productId?: string,
): Promise<{ preview?: EbayPreviewView; error?: string }> {
  await requireAdminSession();
  const parsed = ebayFetchSchema.safeParse({ source, productId: productId ?? "" });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid eBay listing." };
  }

  try {
    const preview = await previewEbayListing(parsed.data.source, parsed.data.productId || null);
    return {
      preview: {
        itemId: preview.listing.itemId,
        title: preview.listing.title,
        brand: preview.listing.brand,
        modelNumber: preview.listing.modelNumber ?? "",
        gtin: preview.listing.gtin ?? "",
        mpn: preview.listing.mpn ?? "",
        shortDescription: preview.listing.shortDescription,
        description: preview.listing.description,
        price: preview.listing.price,
        originalPrice: preview.listing.originalPrice,
        currency: preview.listing.currency,
        condition: preview.listing.condition,
        sellerName: preview.listing.sellerName,
        imageUrl: preview.listing.imageUrl,
        additionalImageUrls: preview.listing.additionalImageUrls,
        productUrl: preview.listing.productUrl,
        affiliateUrl: preview.listing.affiliateUrl,
        affiliateReferenceId: preview.listing.affiliateReferenceId,
        availability: preview.listing.availability,
        suggestedSlug: preview.suggestedSlug,
        existingOffer: preview.existingOffer,
        identifierMatches: preview.identifierMatches,
      },
    };
  } catch (error) {
    return { error: userFacingEbayMessage(error) };
  }
}

export async function searchCatalogProductsAction(query: string) {
  await requireAdminSession();
  if (typeof query !== "string") {
    return { products: [] as Awaited<ReturnType<typeof searchProductsForAttach>> };
  }
  const products = await searchProductsForAttach(query);
  return { products };
}

export async function importEbayProductAction(input: unknown): Promise<{ productId?: string; error?: string }> {
  const session = await requireAdminSession();
  const parsed = ebayImportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import data." };
  }

  if (parsed.data.mode === "attach" && !parsed.data.attachProductId) {
    return { error: "Select an existing product, or choose Create new product." };
  }

  try {
    const result = await importEbayListing({
      itemId: parsed.data.itemId,
      mode: parsed.data.mode,
      attachProductId: parsed.data.attachProductId || null,
      categoryId: parsed.data.categoryId ?? "",
      title: parsed.data.title,
      slug: parsed.data.slug ?? "",
      brand: parsed.data.brand,
      modelNumber: parsed.data.modelNumber ?? "",
      gtin: parsed.data.gtin ?? "",
      mpn: parsed.data.mpn ?? "",
      shortDescription: parsed.data.shortDescription,
      longDescription: parsed.data.longDescription,
      status: parsed.data.status,
      isFeatured: parsed.data.isFeatured,
      createdById: session.sub,
    });
    await writeAuditLog({
      actor: session,
      action: parsed.data.mode === "attach" ? "EBAY_OFFER_ATTACHED" : "EBAY_PRODUCT_IMPORTED",
      entityType: "Product",
      entityId: result.product.id,
      after: { itemId: parsed.data.itemId, mode: parsed.data.mode },
    });
    revalidatePublicCatalog();
    revalidateProductPage(result.product.slug);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${result.product.id}/edit`);
    return { productId: result.product.id };
  } catch (error) {
    return { error: userFacingEbayMessage(error) };
  }
}
