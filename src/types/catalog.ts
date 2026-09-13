/**
 * Domain types shared across the public site and the admin dashboard.
 *
 * These intentionally mirror the shape of the Prisma models (see
 * `prisma/schema.prisma`) without importing generated Prisma types directly,
 * because in this phase pages render from `src/lib/placeholder-data.ts`
 * instead of live database queries. Once real data fetching lands (see
 * README / remaining work), these can be re-derived from Prisma's generated
 * types (e.g. `Prisma.ProductGetPayload<...>`) with minimal churn since the
 * field names already match.
 */

export type MarketplaceCode = "AMAZON" | "EBAY";

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface MarketplaceLink {
  marketplace: MarketplaceCode;
  label: string;
  /**
   * Placeholder destination only. Real affiliate URLs (with tracking tags)
   * are wired up in the marketplace integration phase.
   */
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
  marketplaces: MarketplaceLink[];
  publishedAt: string;
}

export interface ProductDetail extends ProductSummary {
  longDescription: string;
}
