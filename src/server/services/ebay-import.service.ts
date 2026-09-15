import type { Prisma } from "@/generated/prisma/client";
import { isApprovedImageUrl } from "@/lib/approved-image-url";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { EbayListingWithAffiliate } from "@/server/ebay/ebay.service";
import { getEbayService } from "@/server/ebay/ebay.factory";
import { matchProductIdentifiers } from "@/server/services/product-match";
import { allocateUniqueSlug } from "@/server/services/product.service";
import {
  findOfferByRetailerProductId,
  getMarketplaceByCode,
  upsertEbayOffer,
} from "@/server/services/retailer-offer.service";

export interface MatchCandidateView {
  id: string;
  title: string;
  slug: string;
  brand: string;
  reason: string;
}

export interface EbayImportPreview {
  listing: EbayListingWithAffiliate;
  suggestedSlug: string;
  existingOffer: { productId: string; productTitle: string; productSlug: string; offerId: string } | null;
  identifierMatches: MatchCandidateView[];
}

export interface ImportEbayInput {
  itemId: string;
  mode: "create" | "attach";
  attachProductId?: string | null;
  categoryId?: string;
  title: string;
  slug: string;
  brand: string;
  modelNumber: string;
  gtin: string;
  mpn: string;
  shortDescription: string;
  longDescription: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured: boolean;
  createdById?: string;
}

export async function previewEbayListing(raw: string, productId?: string | null): Promise<EbayImportPreview> {
  const listing = await getEbayService().getListingByInput(raw, productId);
  const marketplace = await getMarketplaceByCode("EBAY");
  const existingLink = marketplace
    ? await findOfferByRetailerProductId(marketplace.id, listing.itemId)
    : null;

  const identifierClauses: Prisma.ProductWhereInput[] = [];
  if (listing.gtin) {
    identifierClauses.push({ gtin: listing.gtin });
  }
  if (listing.mpn) {
    identifierClauses.push({ mpn: listing.mpn });
  }
  if (listing.brand && listing.modelNumber) {
    identifierClauses.push({
      brand: { equals: listing.brand, mode: "insensitive" },
      modelNumber: listing.modelNumber,
    });
  }

  const identifierPool = identifierClauses.length
    ? await prisma.product.findMany({
        where: { OR: identifierClauses },
        select: { id: true, title: true, slug: true, brand: true, gtin: true, mpn: true, modelNumber: true },
        take: 8,
      })
    : [];

  const matches = matchProductIdentifiers(listing, identifierPool).map((match) => {
    const product = identifierPool.find((entry) => entry.id === match.id);
    return {
      id: match.id,
      title: product?.title ?? "",
      slug: product?.slug ?? "",
      brand: product?.brand ?? "",
      reason: match.reason,
    };
  });

  return {
    listing,
    suggestedSlug: slugify(listing.title) || `ebay-${listing.itemId}`,
    existingOffer: existingLink
      ? {
          productId: existingLink.product.id,
          productTitle: existingLink.product.title,
          productSlug: existingLink.product.slug,
          offerId: existingLink.id,
        }
      : null,
    identifierMatches: matches.filter((match) => match.id !== existingLink?.productId),
  };
}

export async function searchEbayListings(query: string) {
  return getEbayService().search(query, 12);
}

export async function searchProductsForAttach(query: string) {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return [];
  }

  return prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: normalized, mode: "insensitive" } },
        { brand: { contains: normalized, mode: "insensitive" } },
        { slug: { contains: normalized, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, slug: true, brand: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
}

export async function importEbayListing(input: ImportEbayInput) {
  const listing = await getEbayService().getListingByLegacyId(input.itemId, input.attachProductId);

  const marketplace = await getMarketplaceByCode("EBAY");
  if (!marketplace) {
    throw new Error("The eBay marketplace record is missing. Re-run the database seed.");
  }

  const categoryId = input.categoryId?.trim();
  if (input.mode === "create") {
    if (!categoryId) {
      throw new Error("Select a RadarCut category.");
    }
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new Error("Select a RadarCut category.");
    }
  }

  const importJob = await prisma.productImport.create({
    data: {
      marketplaceId: marketplace.id,
      sourceType: "EXTERNAL_ID",
      externalProductId: listing.itemId,
      sourceUrl: listing.productUrl,
      status: "RUNNING",
      createdById: input.createdById,
      startedAt: new Date(),
    },
  });

  try {
    const product =
      input.mode === "attach"
        ? await attachToExistingProduct(input, listing)
        : await createProductFromListing(input, listing);

    const trackedListing = await getEbayService().getListingByLegacyId(listing.itemId, product.id);
    const offer = await upsertEbayOffer(product.id, trackedListing);

    await prisma.productImport.update({
      where: { id: importJob.id },
      data: {
        status: "COMPLETED",
        productId: product.id,
        finishedAt: new Date(),
        errorMessage: null,
      },
    });

    return { product, offerId: offer.id };
  } catch (error) {
    await prisma.productImport.update({
      where: { id: importJob.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Import failed",
      },
    });
    throw error;
  }
}

export async function refreshEbayOffer(offerId: string) {
  const offer = await prisma.affiliateLink.findUnique({
    where: { id: offerId },
    include: { marketplace: true, product: { select: { id: true } } },
  });
  if (!offer || offer.marketplace.code !== "EBAY") {
    throw new Error("Only eBay offers can be refreshed right now.");
  }

  const listing = await getEbayService().getListingByLegacyId(offer.externalProductId, offer.productId);
  await upsertEbayOffer(offer.productId, listing);
  return prisma.affiliateLink.findUniqueOrThrow({ where: { id: offer.id } });
}

async function attachToExistingProduct(input: ImportEbayInput, listing: EbayListingWithAffiliate) {
  const productId = input.attachProductId?.trim();
  if (!productId) {
    throw new Error("Select an existing product to attach this eBay offer to.");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("That product no longer exists.");
  }

  const identifiers = {
    modelNumber: input.modelNumber.trim() || product.modelNumber || listing.modelNumber,
    gtin: input.gtin.trim() || product.gtin || listing.gtin,
    mpn: input.mpn.trim() || product.mpn || listing.mpn,
  };

  return prisma.product.update({
    where: { id: product.id },
    data: identifiers,
  });
}

async function createProductFromListing(input: ImportEbayInput, listing: EbayListingWithAffiliate) {
  if (!input.categoryId) {
    throw new Error("Select a RadarCut category.");
  }
  const slug = await allocateUniqueSlug(input.slug || listing.title);
  const title = input.title.trim() || listing.title;
  const brand = input.brand.trim() || listing.brand || "Unknown";
  const shortDescription = clip(input.shortDescription.trim() || listing.shortDescription || title, 300);
  const longDescription = clip(input.longDescription.trim() || listing.description || shortDescription, 5000);
  const imageUrl = listing.imageUrl && isApprovedImageUrl(listing.imageUrl) ? listing.imageUrl : null;
  const extraImages = listing.additionalImageUrls.filter(isApprovedImageUrl).slice(0, 4);

  return prisma.product.create({
    data: {
      title,
      slug,
      brand,
      modelNumber: input.modelNumber.trim() || listing.modelNumber,
      gtin: input.gtin.trim() || listing.gtin,
      mpn: input.mpn.trim() || listing.mpn,
      categoryId: input.categoryId,
      shortDescription,
      longDescription,
      status: input.status,
      isFeatured: input.isFeatured,
      currency: listing.currency,
      displayPrice: listing.price,
      originalPrice: listing.originalPrice,
      ogImageUrl: imageUrl,
      createdById: input.createdById,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      images: imageUrl
        ? {
            create: [
              { url: imageUrl, altText: title, position: 0, isPrimary: true },
              ...extraImages.map((url, index) => ({
                url,
                altText: `${title} ${index + 2}`,
                position: index + 1,
                isPrimary: false,
              })),
            ],
          }
        : undefined,
    },
  });
}

function clip(value: string, max: number): string {
  return value.slice(0, max);
}
