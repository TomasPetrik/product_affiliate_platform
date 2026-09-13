import type { ProductStatus } from "@/generated/prisma/enums";

export const PRODUCT_PAGE_SIZES = [25, 50, 100] as const;
export const PRODUCT_SORT_FIELDS = ["updatedAt", "title", "displayPrice", "status"] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
export type ProductSortDir = "asc" | "desc";

export interface ProductAdminQuery {
  q: string;
  status: ProductStatus | "ALL";
  categoryId: string;
  marketplaceId: string;
  featured: boolean;
  trending: boolean;
  sort: ProductSortField;
  dir: ProductSortDir;
  page: number;
  pageSize: number;
}

const DEFAULT_QUERY: ProductAdminQuery = {
  q: "",
  status: "ALL",
  categoryId: "",
  marketplaceId: "",
  featured: false,
  trending: false,
  sort: "updatedAt",
  dir: "desc",
  page: 1,
  pageSize: 25,
};

function first(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseProductAdminQuery(
  params: Record<string, string | string[] | undefined>,
): ProductAdminQuery {
  const statusRaw = first(params, "status");
  const status: ProductAdminQuery["status"] =
    statusRaw === "DRAFT" || statusRaw === "PUBLISHED" || statusRaw === "ARCHIVED" ? statusRaw : "ALL";

  const sortRaw = first(params, "sort");
  const sort: ProductSortField = PRODUCT_SORT_FIELDS.includes(sortRaw as ProductSortField)
    ? (sortRaw as ProductSortField)
    : DEFAULT_QUERY.sort;

  const dirRaw = first(params, "dir");
  const dir: ProductSortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : DEFAULT_QUERY.dir;

  const page = Math.max(1, Number.parseInt(first(params, "page"), 10) || 1);
  const pageSizeRaw = Number.parseInt(first(params, "pageSize"), 10);
  const pageSize = PRODUCT_PAGE_SIZES.includes(pageSizeRaw as (typeof PRODUCT_PAGE_SIZES)[number])
    ? (pageSizeRaw as ProductAdminQuery["pageSize"])
    : DEFAULT_QUERY.pageSize;

  return {
    q: first(params, "q"),
    status,
    categoryId: first(params, "category"),
    marketplaceId: first(params, "marketplace"),
    featured: first(params, "featured") === "1",
    trending: first(params, "trending") === "1",
    sort,
    dir,
    page,
    pageSize,
  };
}

const FILTER_KEYS = [
  "q",
  "status",
  "categoryId",
  "marketplaceId",
  "featured",
  "trending",
  "sort",
  "dir",
  "pageSize",
] as const;

export function productListHref(query: ProductAdminQuery, patch: Partial<ProductAdminQuery> = {}): string {
  const next: ProductAdminQuery = { ...query, ...patch };
  const resetsPage = FILTER_KEYS.some((key) => patch[key] !== undefined) && patch.page === undefined;
  if (resetsPage) {
    next.page = 1;
  }

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status !== "ALL") params.set("status", next.status);
  if (next.categoryId) params.set("category", next.categoryId);
  if (next.marketplaceId) params.set("marketplace", next.marketplaceId);
  if (next.featured) params.set("featured", "1");
  if (next.trending) params.set("trending", "1");
  if (next.sort !== DEFAULT_QUERY.sort) params.set("sort", next.sort);
  if (next.dir !== DEFAULT_QUERY.dir || next.sort !== DEFAULT_QUERY.sort) params.set("dir", next.dir);
  if (next.pageSize !== DEFAULT_QUERY.pageSize) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));

  const qs = params.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export function toggleSortHref(query: ProductAdminQuery, field: ProductSortField): string {
  const dir: ProductSortDir = query.sort === field && query.dir === "asc" ? "desc" : "asc";
  // First click on a new column sorts desc for dates/prices, asc for title/status.
  if (query.sort !== field) {
    return productListHref(query, { sort: field, dir: field === "title" || field === "status" ? "asc" : "desc" });
  }
  return productListHref(query, { sort: field, dir });
}
