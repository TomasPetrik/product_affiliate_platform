import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OfferEditForm } from "@/components/admin/offer-edit-form";
import { env } from "@/lib/env";
import { getRetailerOfferById, type AdminRetailerOffer } from "@/server/services/retailer-offer.service";

export const metadata: Metadata = {
  title: "Edit retailer offer",
};

interface EditOfferPageProps {
  params: Promise<{ id: string; linkId: string }>;
}

export default async function EditRetailerOfferPage({ params }: EditOfferPageProps) {
  const { id, linkId } = await params;
  const offer = await getRetailerOfferById(linkId);

  if (!offer || offer.productId !== id) {
    notFound();
  }

  const view: AdminRetailerOffer = {
    id: offer.id,
    productId: offer.productId,
    marketplaceId: offer.marketplaceId,
    marketplaceCode: offer.marketplace.code,
    marketplaceName: offer.marketplace.name,
    externalProductId: offer.externalProductId,
    listingTitle: offer.listingTitle,
    price: offer.lastKnownPrice ? Number(offer.lastKnownPrice) : null,
    originalPrice: offer.lastKnownOriginalPrice ? Number(offer.lastKnownOriginalPrice) : null,
    currency: offer.lastKnownPriceCurrency,
    availability: offer.lastKnownAvailability,
    productUrl: offer.rawProductUrl,
    affiliateUrl: offer.affiliateUrl,
    imageUrl: offer.imageUrl,
    sellerName: offer.sellerName,
    condition: offer.condition,
    trackingTag: offer.trackingTag,
    isActive: offer.isActive,
    isPrimary: offer.isPrimary,
    lastSyncedAt: offer.lastSyncedAt?.toISOString() ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit retailer offer</h1>
        <p className="mt-1 text-sm text-muted-foreground">{offer.product.title}</p>
      </div>
      <OfferEditForm offer={view} amazonAssociatesTag={env.AMAZON_ASSOCIATES_TAG ?? null} />
    </div>
  );
}
