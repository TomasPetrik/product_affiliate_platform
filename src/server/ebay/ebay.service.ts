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
  type NormalizedEbaySearchHit,
} from "@/server/ebay/ebay-normalize";
import { parseEbayListingInput, isLiveEbayListingUrl } from "@/server/ebay/ebay-url";

export interface EbayListingWithAffiliate {
  itemId: string;
  restItemId: string | null;
  title: string;
  shortDescription: string;
  description: string;
  brand: string;
  modelNumber: string | null;
  gtin: string | null;
  mpn: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  condition: string | null;
  sellerName: string | null;
  availability: string | null;
  imageUrl: string | null;
  additionalImageUrls: string[];
  productUrl: string;
  itemAffiliateWebUrl: string | null;
  ended: boolean;
  buyingOptions: string[];
  affiliateUrl: string;
  affiliateReferenceId: string;
  /** True when the pasted URL/ID was a multi-variation item group. */
  fromItemGroup: boolean;
  itemGroupId: string | null;
}

interface EbayItemGroupResponse {
  items?: EbayBrowseItem[];
  commonDescriptions?: Array<{ description?: string; itemIds?: string[] }>;
}

type ListingCore = Omit<EbayListingWithAffiliate, "fromItemGroup" | "itemGroupId">;

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

    const trimmed = raw.trim();
    if (trimmed.startsWith("v1|")) {
      const listing = await this.fetchByRestItemId(trimmed, productId);
      return { ...listing, fromItemGroup: false, itemGroupId: null };
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

  async getListingByLegacyId(itemKey: string, productId?: string | null): Promise<EbayListingWithAffiliate> {
    const trimmed = itemKey.trim();

    // Re-import / refresh of a previously resolved variation uses the REST item id.
    if (trimmed.startsWith("v1|")) {
      const listing = await this.fetchByRestItemId(trimmed, productId);
      return { ...listing, fromItemGroup: false, itemGroupId: null };
    }

    if (!/^\d{6,19}$/.test(trimmed)) {
      throw new EbayServiceError("INVALID_ITEM_ID", "That eBay item ID is not valid.");
    }

    try {
      const listing = await this.fetchByLegacyItemId(trimmed, productId);
      return { ...listing, fromItemGroup: false, itemGroupId: null };
    } catch (error) {
      const itemGroupId = extractItemGroupId(error) ?? (isItemGroupError(error) ? trimmed : null);
      if (!itemGroupId) {
        throw error;
      }
      return this.getListingFromItemGroup(itemGroupId, productId);
    }
  }

  private async getListingFromItemGroup(
    itemGroupId: string,
    productId?: string | null,
  ): Promise<EbayListingWithAffiliate> {
    const affiliateReferenceId = ebayAffiliateReferenceId({ productId, itemId: itemGroupId });
    const params = new URLSearchParams({ item_group_id: itemGroupId });
    const json = (await this.client.browseGet(
      `/buy/browse/v1/item/get_items_by_item_group?${params.toString()}`,
      affiliateReferenceId,
    )) as EbayItemGroupResponse;

    const items = applyCommonDescriptions(json.items ?? [], json.commonDescriptions ?? []);
    const picked = pickFirstAvailableVariation(items);
    if (!picked) {
      throw new EbayServiceError(
        "UNAVAILABLE",
        "That eBay item group has no available variations to import.",
      );
    }

    const restItemId = picked.itemId?.trim();
    if (!restItemId) {
      throw new EbayServiceError(
        "INVALID_ITEM_ID",
        "That eBay item group did not return a usable variation id.",
      );
    }

    // Fetch the child by REST id — variations share the parent legacy id, so
    // get_item_by_legacy_id would hit the same item-group error again.
    const listing = await this.fetchByRestItemId(restItemId, productId);
    return { ...listing, fromItemGroup: true, itemGroupId };
  }

  private async fetchByLegacyItemId(legacyItemId: string, productId?: string | null): Promise<ListingCore> {
    const affiliateReferenceId = ebayAffiliateReferenceId({ productId, itemId: legacyItemId });
    const params = new URLSearchParams({
      legacy_item_id: legacyItemId,
      fieldgroups: "PRODUCT",
    });

    const json = (await this.client.browseGet(
      `/buy/browse/v1/item/get_item_by_legacy_id?${params.toString()}`,
      affiliateReferenceId,
    )) as EbayBrowseItem;

    return this.listingFromBrowseItem(json, legacyItemId, affiliateReferenceId);
  }

  private async fetchByRestItemId(restItemId: string, productId?: string | null): Promise<ListingCore> {
    const trackingKey = restItemId.replace(/\|/g, "-");
    const affiliateReferenceId = ebayAffiliateReferenceId({ productId, itemId: trackingKey });
    const params = new URLSearchParams({ fieldgroups: "PRODUCT" });
    const json = (await this.client.browseGet(
      `/buy/browse/v1/item/${encodeURIComponent(restItemId)}?${params.toString()}`,
      affiliateReferenceId,
    )) as EbayBrowseItem;

    // Prefer the REST id as the stable retailer key for multi-variation children.
    return this.listingFromBrowseItem(json, restItemId, affiliateReferenceId, { preferRestItemId: true });
  }

  private listingFromBrowseItem(
    json: EbayBrowseItem,
    fallbackItemId: string,
    affiliateReferenceId: string,
    options?: { preferRestItemId?: boolean },
  ): ListingCore {
    const listing = normalizeEbayItem(json);
    if (options?.preferRestItemId && json.itemId?.trim()) {
      listing.itemId = json.itemId.trim();
    } else if (!listing.itemId) {
      listing.itemId = fallbackItemId;
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

/** Pull item_group_id from eBay's suggested get_items_by_item_group href. */
export function extractItemGroupId(error: unknown): string | null {
  if (!(error instanceof EbayServiceError) || !error.message) {
    return null;
  }
  const match = error.message.match(/item_group_id=(\d{6,19})/i);
  return match?.[1] ?? null;
}

export function isItemGroupError(error: unknown): boolean {
  if (!(error instanceof EbayServiceError)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("item group") || message.includes("get_items_by_item_group");
}

function applyCommonDescriptions(
  items: EbayBrowseItem[],
  commonDescriptions: Array<{ description?: string; itemIds?: string[] }>,
): EbayBrowseItem[] {
  const descriptionByRestId = new Map<string, string>();
  for (const entry of commonDescriptions) {
    const description = entry.description?.trim();
    if (!description) continue;
    for (const itemId of entry.itemIds ?? []) {
      const key = itemId.trim();
      if (key) descriptionByRestId.set(key, description);
    }
  }

  return items.map((item) => {
    if (item.description?.trim()) return item;
    const restId = item.itemId?.trim();
    const shared = restId ? descriptionByRestId.get(restId) : undefined;
    return shared ? { ...item, description: shared } : item;
  });
}

/**
 * Prefer in-stock variations that pass import validation; otherwise first usable child.
 */
export function pickFirstAvailableVariation(items: EbayBrowseItem[]): EbayBrowseItem | null {
  const candidates = items.filter((item) => Boolean(item.itemId?.trim() || item.legacyItemId?.trim()));
  if (candidates.length === 0) {
    return null;
  }

  const ranked = [...candidates].sort((a, b) => variationRank(a) - variationRank(b));
  for (const item of ranked) {
    try {
      validateNormalizedListing(normalizeEbayItem(item));
      return item;
    } catch {
      // try next
    }
  }

  return ranked[0] ?? null;
}

function variationRank(item: EbayBrowseItem): number {
  const status = item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus;
  if (status === "IN_STOCK") return 0;
  if (status === "LIMITED_STOCK" || status === "AVAILABLE_FOR_ORDER") return 1;
  if (status === "OUT_OF_STOCK") return 9;
  return 5;
}

export function createEbayService(config: EbayClientConfig): EbayService {
  return new EbayService(new EbayClient(config), config.affiliateCampaignId, config.environment);
}
