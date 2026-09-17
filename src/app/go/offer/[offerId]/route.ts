import { resolvePublishedAffiliateTargetByOfferId } from "@/server/services/affiliate-redirect.service";
import { noStoreRedirect, redirectAfterAffiliateClick, siteUrl } from "@/server/services/affiliate-hop";

export const dynamic = "force-dynamic";

/**
 * Offer-level affiliate hop: `/go/offer/{retailerOfferId}`.
 * Validates the stored offer, records `affiliate_click`, then 302s to the
 * real retailer URL. The destination is never taken from the query string.
 */
export async function GET(request: Request, context: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await context.params;
  const target = await resolvePublishedAffiliateTargetByOfferId(offerId);

  if (!target) {
    return noStoreRedirect(siteUrl("/"));
  }

  return redirectAfterAffiliateClick({
    request,
    linkId: target.linkId,
    path: `/go/offer/${target.linkId}`,
    destinationUrl: target.destinationUrl,
  });
}
