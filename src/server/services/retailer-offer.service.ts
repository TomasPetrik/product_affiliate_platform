import type { Prisma } from "@/generated/prisma/client";
import { computeDiscountPercentage } from "@/lib/format";
import { pickLowestPricedOffer } from "@/lib/lowest-offer-price";
import { prisma } from "@/lib/prisma";
import { retailerLabel } from "@/lib/retailer";
import type { EbayListingWithAffiliate } from "@/server/ebay/ebay.service";

export class RetailerOfferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetailerOfferError";
  }
}

export interface AdminRetailerOffer {
  id: string;
  productId: string;
  marketplaceId: string;
  marketplaceCode: string;
  marketplaceName: string;
  externalProductId: string;
  listingTitle: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string | null;
  availability: string | null;
  productUrl: string;
  affiliateUrl: string;
  imageUrl: string | null;
  sellerName: string | null;
  condition: string | null;
  trackingTag: string | null;
  isActive: boolean;
  isPrimary: boolean;
  lastSyncedAt: string | null;
}

function toAdminOffer(link: {
  id: string;
  productId: string;
  marketplaceId: string;
  externalProductId: string;
  listingTitle: string | null;
  lastKnownPrice: Prisma.Decimal | null;
  lastKnownOriginalPrice: Prisma.Decimal | null;
  lastKnownPriceCurrency: string | null;
  lastKnownAvailability: string | null;
  rawProductUrl: string;
  affiliateUrl: string;
  imageUrl: string | null;
  sellerName: string | null;
  condition: string | null;
  trackingTag: string | null;
  isActive: boolean;
  isPrimary: boolean;
  lastSyncedAt: Date | null;
  marketplace: { code: string; name: string };
}): AdminRetailerOffer {
  return {
    id: link.id,
    productId: link.productId,
    marketplaceId: link.marketplaceId,
    marketplaceCode: link.marketplace.code,
    marketplaceName: link.marketplace.name,
    externalProductId: link.externalProductId,
    listingTitle: link.listingTitle,
    price: link.lastKnownPrice ? Number(link.lastKnownPrice) : null,
    originalPrice: link.lastKnownOriginalPrice ? Number(link.lastKnownOriginalPrice) : null,
    currency: link.lastKnownPriceCurrency,
    availability: link.lastKnownAvailability,
    productUrl: link.rawProductUrl,
    affiliateUrl: link.affiliateUrl,
    imageUrl: link.imageUrl,
    sellerName: link.sellerName,
    condition: link.condition,
    trackingTag: link.trackingTag,
    isActive: link.isActive,
    isPrimary: link.isPrimary,
    lastSyncedAt: link.lastSyncedAt?.toISOString() ?? null,
  };
}

const offerInclude = { marketplace: { select: { code: true, name: true } } } as const;

export async function listRetailerOffersForProduct(productId: string): Promise<AdminRetailerOffer[]> {
  const links = await prisma.affiliateLink.findMany({
    where: { productId },
    include: offerInclude,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return links.map(toAdminOffer);
}

export async function getRetailerOfferById(id: string) {
  return prisma.affiliateLink.findUnique({
    where: { id },
    include: {
      marketplace: true,
      product: { select: { id: true, slug: true, title: true } },
    },
  });
}

export async function findOfferByRetailerProductId(marketplaceId: string, externalProductId: string) {
  return prisma.affiliateLink.findUnique({
    where: { marketplaceId_externalProductId: { marketplaceId, externalProductId } },
    include: {
      marketplace: true,
      product: { select: { id: true, slug: true, title: true } },
    },
  });
}

export async function getMarketplaceByCode(code: "AMAZON" | "EBAY" | "WALMART" | "BEST_BUY" | "TARGET" | "OTHER") {
  return prisma.marketplace.findUnique({ where: { code } });
}

function offerWriteData(listing: EbayListingWithAffiliate) {
  return {
    externalProductId: listing.itemId,
    rawProductUrl: listing.productUrl,
    affiliateUrl: listing.affiliateUrl,
    trackingTag: listing.affiliateReferenceId,
    listingTitle: listing.title,
    sellerName: listing.sellerName,
    condition: listing.condition,
    imageUrl: listing.imageUrl,
    lastKnownPrice: listing.price,
    lastKnownOriginalPrice: listing.originalPrice,
    lastKnownPriceCurrency: listing.currency,
    lastKnownAvailability: listing.availability,
    lastSyncedAt: new Date(),
    lastCheckedAt: new Date(),
    isActive: true,
    metadata: {
      restItemId: listing.restItemId,
      gtin: listing.gtin,
      mpn: listing.mpn,
      brand: listing.brand,
      modelNumber: listing.modelNumber,
      buyingOptions: listing.buyingOptions,
    } satisfies Prisma.InputJsonValue,
  };
}

export async function upsertEbayOffer(productId: string, listing: EbayListingWithAffiliate) {
  const marketplace = await getMarketplaceByCode("EBAY");
  if (!marketplace) {
    throw new RetailerOfferError("The eBay marketplace record is missing. Re-run the database seed.");
  }

  const existing = await prisma.affiliateLink.findUnique({
    where: {
      marketplaceId_externalProductId: {
        marketplaceId: marketplace.id,
        externalProductId: listing.itemId,
      },
    },
  });

  if (existing && existing.productId !== productId) {
    throw new RetailerOfferError(
      `This eBay listing is already attached to another product. Remove it there first, or open that product.`,
    );
  }

  const siblingCount = await prisma.affiliateLink.count({ where: { productId } });
  const data = {
    ...offerWriteData(listing),
    isPrimary: siblingCount === 0 || existing?.isPrimary === true,
  };

  const offer = existing
    ? await prisma.affiliateLink.update({ where: { id: existing.id }, data })
    : await prisma.affiliateLink.create({
        data: {
          productId,
          marketplaceId: marketplace.id,
          ...data,
        },
      });

  await syncProductDisplayPrice(productId);
  return offer;
}

export async function deleteRetailerOffer(id: string) {
  const existing = await prisma.affiliateLink.findUnique({
    where: { id },
    select: { id: true, productId: true, marketplace: { select: { name: true } } },
  });
  if (!existing) {
    throw new RetailerOfferError("Retailer offer not found.");
  }

  await prisma.affiliateLink.delete({ where: { id } });
  await syncProductDisplayPrice(existing.productId);
  return existing;
}

export async function updateRetailerOfferManual(
  id: string,
  input: {
    affiliateUrl: string;
    rawProductUrl: string;
    trackingTag: string | null;
    lastKnownPrice: number | null;
    lastKnownOriginalPrice: number | null;
    lastKnownPriceCurrency: string | null;
    lastKnownAvailability: string | null;
    isActive: boolean;
    isPrimary: boolean;
  },
) {
  const existing = await prisma.affiliateLink.findUnique({ where: { id } });
  if (!existing) {
    throw new RetailerOfferError("Retailer offer not found.");
  }

  if (input.isPrimary) {
    await prisma.affiliateLink.updateMany({
      where: { productId: existing.productId, NOT: { id } },
      data: { isPrimary: false },
    });
  }

  const updated = await prisma.affiliateLink.update({
    where: { id },
    data: {
      affiliateUrl: input.affiliateUrl,
      rawProductUrl: input.rawProductUrl || input.affiliateUrl,
      trackingTag: input.trackingTag,
      lastKnownPrice: input.lastKnownPrice,
      lastKnownOriginalPrice: input.lastKnownOriginalPrice,
      lastKnownPriceCurrency: input.lastKnownPriceCurrency,
      lastKnownAvailability: input.lastKnownAvailability,
      isActive: input.isActive,
      isPrimary: input.isPrimary,
    },
  });

  await syncProductDisplayPrice(existing.productId);
  return updated;
}

export async function syncProductDisplayPrice(productId: string) {
  const offers = await prisma.affiliateLink.findMany({
    where: { productId, isActive: true, lastKnownPrice: { not: null } },
  });
  // Always surface the cheapest active offer on cards/PDP — not the primary CTA retailer.
  const best = pickLowestPricedOffer(offers);
  if (!best?.lastKnownPrice) {
    return;
  }

  const displayPrice = Number(best.lastKnownPrice);
  const originalPrice = best.lastKnownOriginalPrice ? Number(best.lastKnownOriginalPrice) : null;

  await prisma.product.update({
    where: { id: productId },
    data: {
      displayPrice,
      currency: best.lastKnownPriceCurrency ?? "USD",
      originalPrice,
      discountPercentage: computeDiscountPercentage(displayPrice, originalPrice),
    },
  });
}

export function offerStatusLabel(offer: Pick<AdminRetailerOffer, "isActive" | "availability">): string {
  if (!offer.isActive) return "Inactive";
  if (offer.availability === "OUT_OF_STOCK") return "Out of stock";
  if (offer.availability === "IN_STOCK" || offer.availability === "LIMITED_QUANTITY") return "Active";
  return offer.isActive ? "Active" : "Inactive";
}

export { retailerLabel };
