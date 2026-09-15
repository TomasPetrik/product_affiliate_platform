const CUSTOM_ID_MAX = 256;

/**
 * Deterministic ePN custom tracking ID so conversions can be attributed
 * back to a RadarCut product (and the eBay item when the product is not
 * known yet).
 */
export function ebayAffiliateReferenceId(input: { productId?: string | null; itemId: string }): string {
  if (input.productId) {
    return clip(`radarcut-product-${input.productId}`);
  }
  return clip(`radarcut-ebay-${input.itemId}`);
}

function clip(value: string): string {
  return value.slice(0, CUSTOM_ID_MAX);
}

export function ebayEndUserContextHeader(campaignId: string, affiliateReferenceId: string): string {
  return `affiliateCampaignId=${campaignId},affiliateReferenceId=${affiliateReferenceId}`;
}

/**
 * Last-resort EPN tracking URL when Browse API omits itemAffiliateWebUrl.
 * Uses the documented rover/itm campid + customid parameters — never the
 * untracked itemWebUrl.
 */
export function buildEbayPartnerNetworkUrl(input: {
  productUrl: string;
  campaignId: string;
  customId: string;
}): string {
  const url = new URL(input.productUrl);
  url.searchParams.set("mkcid", "1");
  url.searchParams.set("mkrid", "711-53200-19255-0");
  url.searchParams.set("siteid", "0");
  url.searchParams.set("campid", input.campaignId);
  url.searchParams.set("customid", input.customId);
  url.searchParams.set("toolid", "10001");
  url.searchParams.set("mkevt", "1");
  return url.toString();
}

export function resolveEbayAffiliateUrl(input: {
  itemAffiliateWebUrl?: string | null;
  productUrl: string;
  campaignId?: string | null;
  customId: string;
  allowSandboxPlaceholder?: boolean;
}): string {
  const fromApi = input.itemAffiliateWebUrl?.trim();
  if (fromApi && isHttpUrl(fromApi) && fromApi !== input.productUrl) {
    return fromApi;
  }
  if (fromApi && isHttpUrl(fromApi) && looksTracked(fromApi)) {
    return fromApi;
  }
  const campaignId = input.campaignId || (input.allowSandboxPlaceholder ? "sandbox" : null);
  if (campaignId) {
    return buildEbayPartnerNetworkUrl({
      productUrl: input.productUrl,
      campaignId,
      customId: input.customId,
    });
  }
  throw new Error("AFFILIATE_URL");
}

function looksTracked(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has("campid") ||
      parsed.searchParams.has("customid") ||
      parsed.hostname.toLowerCase().includes("rover.ebay.") ||
      parsed.hostname.toLowerCase().includes("ebayadvst.com")
    );
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
