import {
  linkIdFromRequest,
  marketplaceFromRequest,
  resolvePublishedAffiliateTarget,
} from "@/server/services/affiliate-redirect.service";
import { noStoreRedirect, redirectAfterAffiliateClick, siteUrl } from "@/server/services/affiliate-hop";

export const dynamic = "force-dynamic";

/**
 * Public affiliate hop.
 *
 * `/go/magnetic-car-phone-holder` → validate published product →
 * pick the active (optionally marketplace-specific) affiliate link →
 * record `affiliate_click` → 302 to the stored marketplace URL.
 *
 * Destination is never taken from the query string.
 */
export async function GET(request: Request, context: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await context.params;
  const requestUrl = new URL(request.url);
  const marketplaceCode = marketplaceFromRequest(requestUrl.searchParams);
  const linkId = linkIdFromRequest(requestUrl.searchParams);
  const home = siteUrl("/");

  const target = await resolvePublishedAffiliateTarget(productSlug, marketplaceCode, linkId);

  if (!target) {
    return noStoreRedirect(home);
  }

  return redirectAfterAffiliateClick({
    request,
    linkId: target.linkId,
    path: `/go/${target.productSlug}`,
    destinationUrl: target.destinationUrl,
  });
}
