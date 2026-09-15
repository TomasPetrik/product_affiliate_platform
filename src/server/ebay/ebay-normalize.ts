export interface EbayConvertedAmount {
  value: string;
  currency: string;
}

export interface EbayImage {
  imageUrl?: string;
}

export interface EbaySeller {
  username?: string;
  feedbackPercentage?: string;
}

export interface EbayAvailability {
  estimatedAvailabilityStatus?: string;
  estimatedAvailableQuantity?: number;
  availabilityThresholdType?: string;
}

export interface EbayMarketingPrice {
  originalPrice?: EbayConvertedAmount;
  discountPercentage?: string;
}

export interface EbayLocalizedAspect {
  type?: string;
  name?: string;
  value?: string;
}

export interface EbayProductContainer {
  brand?: string;
  gtin?: string[];
  mpns?: string[];
  epid?: string;
  image?: EbayImage;
  additionalImages?: EbayImage[];
}

export interface EbayBrowseItem {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  shortDescription?: string;
  description?: string;
  price?: EbayConvertedAmount;
  currentBidPrice?: EbayConvertedAmount;
  marketingPrice?: EbayMarketingPrice;
  image?: EbayImage;
  additionalImages?: EbayImage[];
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  condition?: string;
  conditionId?: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  epid?: string;
  seller?: EbaySeller;
  estimatedAvailabilities?: EbayAvailability[];
  localizedAspects?: EbayLocalizedAspect[];
  product?: EbayProductContainer;
  buyingOptions?: string[];
  itemEndDate?: string;
  adultOnly?: boolean;
}

export interface EbayItemSummary {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  price?: EbayConvertedAmount;
  currentBidPrice?: EbayConvertedAmount;
  image?: EbayImage;
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  condition?: string;
  seller?: EbaySeller;
  buyingOptions?: string[];
}

export interface NormalizedEbayListing {
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
}

export interface NormalizedEbaySearchHit {
  itemId: string;
  title: string;
  price: number | null;
  currency: string | null;
  condition: string | null;
  sellerName: string | null;
  imageUrl: string | null;
  productUrl: string | null;
}

function amountToNumber(amount?: EbayConvertedAmount | null): number | null {
  if (!amount?.value) return null;
  const parsed = Number.parseFloat(amount.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function aspect(item: EbayBrowseItem, names: string[]): string | null {
  const aspects = item.localizedAspects ?? [];
  for (const name of names) {
    const match = aspects.find((entry) => entry.name?.toLowerCase() === name.toLowerCase());
    const value = match?.value?.trim();
    if (value) return value;
  }
  return null;
}

function firstGtin(item: EbayBrowseItem): string | null {
  const direct = item.gtin?.trim() || item.product?.gtin?.[0]?.trim();
  if (direct) return direct.replace(/\s+/g, "");
  const fromAspect = aspect(item, ["UPC", "EAN", "GTIN", "ISBN"]);
  return fromAspect ? fromAspect.replace(/\s+/g, "") : null;
}

function availabilityOf(item: EbayBrowseItem): string | null {
  const status = item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus?.trim();
  return status || null;
}

function isEnded(item: EbayBrowseItem): boolean {
  const availability = availabilityOf(item);
  if (availability === "OUT_OF_STOCK") {
    return true;
  }
  if (!item.itemEndDate) {
    return false;
  }
  const end = Date.parse(item.itemEndDate);
  return Number.isFinite(end) && end < Date.now();
}

export function ebayListingImageUrls(item: EbayBrowseItem): string[] {
  const candidates = [
    item.image?.imageUrl,
    ...(item.additionalImages ?? []).map((image) => image.imageUrl),
    item.product?.image?.imageUrl,
    ...(item.product?.additionalImages ?? []).map((image) => image.imageUrl),
  ];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url) continue;
    const key = ebayImageDedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

function ebayImageDedupeKey(url: string): string {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/images\/g\/([^/]+)/i);
    return (match?.[1] ?? parsed.pathname).toLowerCase();
  } catch {
    return url;
  }
}

export function normalizeEbayItem(item: EbayBrowseItem): NormalizedEbayListing {
  const itemId = item.legacyItemId?.trim() || "";
  const title = item.title?.trim() || "";
  const price = amountToNumber(item.price) ?? amountToNumber(item.currentBidPrice);
  const currency = item.price?.currency || item.currentBidPrice?.currency || "USD";
  const productUrl = item.itemWebUrl?.trim() || "";
  const imageUrls = ebayListingImageUrls(item);
  const imageUrl = imageUrls[0] ?? null;
  const additionalImageUrls = imageUrls.slice(1);

  const brand =
    item.brand?.trim() ||
    item.product?.brand?.trim() ||
    aspect(item, ["Brand", "Manufacturer"]) ||
    "";
  const modelNumber = aspect(item, ["Model", "Model Number"]) || null;
  const mpn = item.mpn?.trim() || item.product?.mpns?.[0]?.trim() || aspect(item, ["MPN"]) || null;
  const shortDescription = item.shortDescription?.trim() || "";
  const description = stripEbayHtml(item.description?.trim() || shortDescription || title);

  return {
    itemId,
    restItemId: item.itemId?.trim() || null,
    title,
    shortDescription: shortDescription || title,
    description,
    brand,
    modelNumber,
    gtin: firstGtin(item),
    mpn,
    price: price ?? 0,
    originalPrice: amountToNumber(item.marketingPrice?.originalPrice),
    currency,
    condition: item.condition?.trim() || null,
    sellerName: item.seller?.username?.trim() || null,
    availability: availabilityOf(item),
    imageUrl,
    additionalImageUrls,
    productUrl,
    itemAffiliateWebUrl: item.itemAffiliateWebUrl?.trim() || null,
    ended: isEnded(item),
    buyingOptions: item.buyingOptions ?? [],
  };
}

export function normalizeEbaySearchHit(item: EbayItemSummary): NormalizedEbaySearchHit | null {
  const itemId = item.legacyItemId?.trim();
  const title = item.title?.trim();
  if (!itemId || !title) {
    return null;
  }

  return {
    itemId,
    title,
    price: amountToNumber(item.price) ?? amountToNumber(item.currentBidPrice),
    currency: item.price?.currency || item.currentBidPrice?.currency || null,
    condition: item.condition?.trim() || null,
    sellerName: item.seller?.username?.trim() || null,
    imageUrl: item.image?.imageUrl?.trim() || null,
    productUrl: item.itemWebUrl?.trim() || null,
  };
}

export function validateNormalizedListing(listing: NormalizedEbayListing): void {
  if (!listing.itemId) {
    throw new Error("INVALID_ITEM_ID");
  }
  if (!listing.title) {
    throw new Error("MISSING_TITLE");
  }
  if (!listing.price || listing.price <= 0) {
    throw new Error("MISSING_PRICE");
  }
  if (!listing.imageUrl) {
    throw new Error("MISSING_IMAGE");
  }
  if (!listing.productUrl) {
    throw new Error("NOT_FOUND");
  }
  if (listing.ended || listing.availability === "OUT_OF_STOCK") {
    throw new Error("UNAVAILABLE");
  }
}

function stripEbayHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000);
}
