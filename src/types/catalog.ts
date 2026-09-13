/**
 * View-model types for the public site (and the admin dashboard rows that
 * mirror it). They intentionally stay decoupled from Prisma's generated
 * types — `src/server/services/catalog.service.ts` maps Prisma query
 * results (which include nullable fields, `Decimal` prices, relations,
 * etc.) into these plain, UI-friendly shapes.
 */

export type MarketplaceCode = "AMAZON" | "EBAY";

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface MarketplaceLink {
  marketplace: MarketplaceCode;
  label: string;
  /** Local `/go/[productSlug]` hop that records the click, then redirects. */
  href: string;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  productCount: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: CategorySummary;
  status: ProductStatus;
  shortDescription: string;
  currency: string;
  displayPrice: number;
  originalPrice: number | null;
  rating: number;
  ratingCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  imageUrl: string | null;
  marketplaces: MarketplaceLink[];
  publishedAt: string;
}

export interface ProductDetail extends ProductSummary {
  longDescription: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
}
