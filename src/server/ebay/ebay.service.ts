import {
  ebayAffiliateReferenceId,
  resolveEbayAffiliateUrl,
} from "@/server/ebay/ebay-affiliate";
import { EbayServiceError } from "@/server/ebay/ebay-errors";
import { EbayClient, type EbayClientConfig } from "@/server/ebay/ebay.client";
import {
  normalizeEbayItem,
  normalizeEbaySearchHit,
  validateNormalizedListing,
  type EbayBrowseItem,
  type EbayItemSummary,
  type NormalizedEbayListing,
  type NormalizedEbaySearchHit,
} from "@/server/ebay/ebay-normalize";
import { parseEbayListingInput, isLiveEbayListingUrl } from "@/server/ebay/ebay-url";

export interface EbayListingWithAffiliate extends NormalizedEbayListing {
  affiliateUrl: string;
  affiliateReferenceId: string;
}

export class EbayService {
  constructor(
    private readonly client: EbayClient,
    private readonly campaignId?: string,
    private readonly environment: "production" | "sandbox" = "production",
  ) {}

  async search(query: string, limit = 10): Promise<NormalizedEbaySearchHit[]> {
    const q = query.trim();
    if (q.length < 2) {
      throw new EbayServiceError("INVALID_URL", "Enter at least 2 characters to search eBay.");
    }

    const params = new URLSearchParams({
      q,
      limit: String(Math.min(20, Math.max(1, limit))),
    });
    const json = (await this.client.browseGet(
      `/buy/browse/v1/item_summary/search?${params.toString()}`,
    )) as { itemSummaries?: EbayItemSummary[] };

    return (json.itemSummaries ?? [])
      .map((item) => normalizeEbaySearchHit(item))
      .filter((item): item is NormalizedEbaySearchHit => item !== null);
  }

  async getListingByInput(raw: string, productId?: string | null): Promise<EbayListingWithAffiliate> {
    if (this.environment === "sandbox" && isLiveEbayListingUrl(raw)) {
      throw new EbayServiceError(
        "INVALID_URL",
        "Sandbox mode cannot import live ebay.com listings. Search eBay below, or paste a sandbox.ebay.com URL / sandbox item ID.",
      );
    }

    let legacyItemId: string;
    try {
      legacyItemId = parseEbayListingInput(raw).legacyItemId;
    } catch (error) {
      throw new EbayServiceError(
        "INVALID_URL",
        error instanceof Error ? error.message : "Invalid eBay listing URL.",
      );
    }
    return this.getListingByLegacyId(legacyItemId, productId);
  }

  async getListingByLegacyId(legacyItemId: string, productId?: string | null): Promise<EbayListingWithAffiliate> {
    if (!/^\d{6,19}$/.test(legacyItemId)) {
      throw new EbayServiceError("INVALID_ITEM_ID", "That eBay item ID is not valid.");
    }

    const affiliateReferenceId = ebayAffiliateReferenceId({ productId, itemId: legacyItemId });
    const params = new URLSearchParams({
      legacy_item_id: legacyItemId,
      fieldgroups: "PRODUCT",
    });

    const json = (await this.client.browseGet(
      `/buy/browse/v1/item/get_item_by_legacy_id?${params.toString()}`,
      affiliateReferenceId,
    )) as EbayBrowseItem;

    const listing = normalizeEbayItem(json);
    if (!listing.itemId) {
      listing.itemId = legacyItemId;
    }

    try {
      validateNormalizedListing(listing);
    } catch (error) {
      throw mapValidationError(error);
    }

    if (!this.campaignId && this.environment !== "sandbox") {
      throw new EbayServiceError(
        "NOT_CONFIGURED",
        "Set EBAY_AFFILIATE_CAMPAIGN_ID to generate eBay Partner Network tracking links.",
      );
    }

    let affiliateUrl: string;
    try {
      affiliateUrl = resolveEbayAffiliateUrl({
        itemAffiliateWebUrl: listing.itemAffiliateWebUrl,
        productUrl: listing.productUrl,
        campaignId: this.campaignId,
        customId: affiliateReferenceId,
        allowSandboxPlaceholder: this.environment === "sandbox",
      });
    } catch {
      throw new EbayServiceError(
        "AFFILIATE_URL",
        "eBay did not return an affiliate tracking URL. Confirm the campaign ID and Browse API affiliate access.",
      );
    }

    if (affiliateUrl === listing.productUrl) {
      throw new EbayServiceError(
        "AFFILIATE_URL",
        "Could not generate an eBay affiliate URL that differs from the public listing URL.",
      );
    }

    return {
      ...listing,
      affiliateUrl,
      affiliateReferenceId,
    };
  }
}

function mapValidationError(error: unknown): EbayServiceError {
  const code = error instanceof Error ? error.message : "API_ERROR";
  switch (code) {
    case "MISSING_TITLE":
      return new EbayServiceError("MISSING_TITLE", "That eBay listing is missing a title and cannot be imported.");
    case "MISSING_PRICE":
      return new EbayServiceError("MISSING_PRICE", "That eBay listing does not have a usable price.");
    case "MISSING_IMAGE":
      return new EbayServiceError("MISSING_IMAGE", "That eBay listing does not have an image.");
    case "UNAVAILABLE":
      return new EbayServiceError("UNAVAILABLE", "That eBay listing has ended or is unavailable.");
    case "INVALID_ITEM_ID":
      return new EbayServiceError("INVALID_ITEM_ID", "That eBay item ID is not valid.");
    case "NOT_FOUND":
      return new EbayServiceError("NOT_FOUND", "That eBay listing was not found.");
    default:
      return new EbayServiceError("API_ERROR", "Could not read that eBay listing.");
  }
}

export function createEbayService(config: EbayClientConfig): EbayService {
  return new EbayService(new EbayClient(config), config.affiliateCampaignId, config.environment);
}
