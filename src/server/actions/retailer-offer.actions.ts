"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withAdminNotice } from "@/lib/admin-notice";
import { requireAdminSession } from "@/lib/auth";
import { userFacingEbayMessage } from "@/server/ebay/ebay-errors";
import { writeAuditLog } from "@/server/services/audit.service";
import { refreshEbayOffer } from "@/server/services/ebay-import.service";
import { revalidateProductPage, revalidatePublicCatalog } from "@/server/services/revalidate";
import {
  deleteRetailerOffer,
  getRetailerOfferById,
  updateRetailerOfferManual,
} from "@/server/services/retailer-offer.service";
import { retailerOfferManualSchema } from "@/server/validations/ebay-import.schema";

export interface RetailerOfferActionState {
  error?: string;
}

function revalidateOfferSurfaces(slug: string) {
  revalidatePublicCatalog();
  revalidateProductPage(slug);
  revalidatePath("/admin/products");
}

export async function refreshEbayOfferAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const offerId = String(formData.get("offerId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  if (!offerId) {
    redirect(`/admin/products/${productId}/edit?error=missing-offer`);
  }

  let productSlug = "";
  let destinationId = productId;

  try {
    const updated = await refreshEbayOffer(offerId);
    const offer = await getRetailerOfferById(updated.id);
    productSlug = offer?.product.slug ?? "";
    destinationId = offer?.product.id ?? productId;
    await writeAuditLog({
      actor: session,
      action: "RETAILER_OFFER_REFRESHED",
      entityType: "AffiliateLink",
      entityId: updated.id,
      after: { marketplace: "EBAY", externalProductId: updated.externalProductId },
    });
  } catch (error) {
    const message = encodeURIComponent(userFacingEbayMessage(error));
    redirect(`/admin/products/${productId}/edit?error=${message}`);
  }

  if (productSlug) {
    revalidateOfferSurfaces(productSlug);
  }
  redirect(withAdminNotice(`/admin/products/${destinationId}/edit`, "updated"));
}

export async function deleteRetailerOfferAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const offerId = String(formData.get("offerId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const before = offerId ? await getRetailerOfferById(offerId) : null;
  if (!before) {
    redirect(`/admin/products/${productId}/edit`);
  }

  await deleteRetailerOffer(offerId);
  await writeAuditLog({
    actor: session,
    action: "RETAILER_OFFER_DELETED",
    entityType: "AffiliateLink",
    entityId: offerId,
    before,
  });
  revalidateOfferSurfaces(before.product.slug);
  redirect(withAdminNotice(`/admin/products/${before.product.id}/edit`, "updated"));
}

export async function saveRetailerOfferAction(
  _prev: RetailerOfferActionState,
  formData: FormData,
): Promise<RetailerOfferActionState> {
  const session = await requireAdminSession();
  const offerId = String(formData.get("offerId") ?? "");
  const parsed = retailerOfferManualSchema.safeParse({
    affiliateUrl: formData.get("affiliateUrl"),
    rawProductUrl: formData.get("rawProductUrl") ?? "",
    trackingTag: formData.get("trackingTag") ?? "",
    isActive: formData.get("isActive") === "on",
    isPrimary: formData.get("isPrimary") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid offer." };
  }

  const before = await getRetailerOfferById(offerId);
  if (!before) {
    return { error: "Retailer offer not found." };
  }

  const updated = await updateRetailerOfferManual(offerId, {
    affiliateUrl: parsed.data.affiliateUrl,
    rawProductUrl: parsed.data.rawProductUrl ?? "",
    trackingTag: parsed.data.trackingTag || null,
    isActive: parsed.data.isActive,
    isPrimary: parsed.data.isPrimary,
  });

  await writeAuditLog({
    actor: session,
    action: "RETAILER_OFFER_UPDATED",
    entityType: "AffiliateLink",
    entityId: updated.id,
    before,
    after: updated,
  });

  revalidateOfferSurfaces(before.product.slug);
  redirect(withAdminNotice(`/admin/products/${before.product.id}/edit`, "updated"));
}
