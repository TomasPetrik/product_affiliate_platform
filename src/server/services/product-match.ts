export interface IdentifierMatchInput {
  gtin?: string | null;
  mpn?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
}

export interface IdentifierMatchCandidate extends IdentifierMatchInput {
  id: string;
}

export type IdentifierMatchReason = "gtin" | "mpn" | "brand_model";

export interface IdentifierMatch {
  id: string;
  reason: IdentifierMatchReason;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
}

function strongGtin(value: string | null | undefined): string | null {
  const normalized = normalizeToken(value).replace(/[^0-9]/g, "");
  return normalized.length >= 8 && normalized.length <= 14 ? normalized : null;
}

function strongModel(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.length >= 3 ? normalized : null;
}

/**
 * Conservative identifier matching only. Title similarity is intentionally
 * not used — the admin must confirm attach vs create when this returns empty.
 */
export function matchProductIdentifiers(
  listing: IdentifierMatchInput,
  products: IdentifierMatchCandidate[],
): IdentifierMatch[] {
  const listingGtin = strongGtin(listing.gtin);
  const listingMpn = normalizeToken(listing.mpn);
  const listingBrand = normalizeToken(listing.brand);
  const listingModel = strongModel(listing.modelNumber);
  const matches: IdentifierMatch[] = [];

  for (const product of products) {
    const productGtin = strongGtin(product.gtin);
    if (listingGtin && productGtin && listingGtin === productGtin) {
      matches.push({ id: product.id, reason: "gtin" });
      continue;
    }

    const productBrand = normalizeToken(product.brand);
    const productMpn = normalizeToken(product.mpn);
    if (listingBrand && productBrand && listingBrand === productBrand && listingMpn && productMpn && listingMpn === productMpn) {
      matches.push({ id: product.id, reason: "mpn" });
      continue;
    }

    const productModel = strongModel(product.modelNumber);
    if (
      listingBrand &&
      productBrand &&
      listingBrand === productBrand &&
      listingModel &&
      productModel &&
      listingModel === productModel
    ) {
      matches.push({ id: product.id, reason: "brand_model" });
    }
  }

  return matches;
}
