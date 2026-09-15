const LEGACY_ITEM_ID_PATTERN = /^\d{6,19}$/;
const REST_ITEM_ID_PATTERN = /^v1\|[^|]+\|[^|]+$/i;

export function ebayHostname(value: string): string {
  return value.replace(/^www\./i, "").toLowerCase();
}

export function isEbayHost(hostname: string): boolean {
  const host = ebayHostname(hostname);
  return host === "ebay.com" || host.startsWith("ebay.") || host.endsWith(".ebay.com");
}

export function isSandboxEbayHost(hostname: string): boolean {
  return ebayHostname(hostname).includes("sandbox.ebay.");
}

export function isLiveEbayListingUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return isEbayHost(url.hostname) && !isSandboxEbayHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Extract a legacy eBay item ID from a pasted listing URL or raw ID.
 * Supports common public URLs such as:
 *   https://www.ebay.com/itm/123456789
 *   https://www.ebay.com/itm/sony-headphones/123456789
 *   https://www.ebay.co.uk/itm/123456789?hash=item...
 */
export function parseEbayListingInput(raw: string): { legacyItemId: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw invalid("Paste an eBay listing URL or item ID.");
  }

  if (LEGACY_ITEM_ID_PATTERN.test(trimmed)) {
    return { legacyItemId: trimmed };
  }

  if (REST_ITEM_ID_PATTERN.test(trimmed)) {
    const legacy = trimmed.split("|")[1] ?? "";
    if (LEGACY_ITEM_ID_PATTERN.test(legacy)) {
      return { legacyItemId: legacy };
    }
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw invalid("That does not look like a valid eBay listing URL or item ID.");
  }

  const host = ebayHostname(url.hostname);
  if (!isEbayHost(host)) {
    throw invalid("Only eBay listing URLs can be imported.");
  }

  const itmMatch = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{6,19})/i);
  if (itmMatch?.[1]) {
    return { legacyItemId: itmMatch[1] };
  }

  const queryId = url.searchParams.get("item") ?? url.searchParams.get("itemid");
  if (queryId && LEGACY_ITEM_ID_PATTERN.test(queryId)) {
    return { legacyItemId: queryId };
  }

  throw invalid("Could not find an eBay item ID in that URL.");
}

export function isLegacyEbayItemId(value: string): boolean {
  return LEGACY_ITEM_ID_PATTERN.test(value.trim());
}

function invalid(message: string): Error {
  const error = new Error(message);
  error.name = "EbayInvalidListingError";
  return error;
}
