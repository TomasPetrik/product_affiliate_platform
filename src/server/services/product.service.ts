import type { Prisma } from "@/generated/prisma/client";
import type { MarketplaceCode, ProductStatus } from "@/generated/prisma/enums";
import { computeDiscountPercentage } from "@/lib/format";
import type { ProductAdminQuery } from "@/lib/product-admin-query";
import { prisma } from "@/lib/prisma";
import type { CategorySummary, MarketplaceLink, ProductDetail } from "@/types/catalog";

export interface ProductAdminRow {
  id: string;
  slug: string;
  title: string;
  status: ProductStatus;
  isFeatured: boolean;
  isTrending: boolean;
  currency: string;
  displayPrice: number | null;
  categoryName: string | null;
  marketplaceLabels: string[];
  imageUrl: string | null;
  updatedAt: string;
}

export interface ProductAdminListResult {
  products: ProductAdminRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ProductImageInput {
  url: string;
  altText: string;
  isPrimary: boolean;
}

function toAdminRow(
  product: {
    id: string;
    slug: string;
    title: string;
    status: ProductStatus;
    isFeatured: boolean;
    isTrending: boolean;
    currency: string;
    displayPrice: Prisma.Decimal | null;
    updatedAt: Date;
    category: { name: string } | null;
    affiliateLinks: Array<{ marketplace: { name: string } }>;
    images: Array<{ url: string }>;
    ogImageUrl: string | null;
  },
): ProductAdminRow {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    status: product.status,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    currency: product.currency,
    displayPrice: product.displayPrice ? Number(product.displayPrice) : null,
    categoryName: product.category?.name ?? null,
    marketplaceLabels: product.affiliateLinks.map((link) => link.marketplace.name),
    imageUrl: product.images[0]?.url ?? product.ogImageUrl ?? null,
    updatedAt: product.updatedAt.toISOString(),
  };
}

function buildAdminWhere(query: ProductAdminQuery): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [];

  if (query.q) {
    clauses.push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { brand: { contains: query.q, mode: "insensitive" } },
        { slug: { contains: query.q, mode: "insensitive" } },
        { affiliateLinks: { some: { externalProductId: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }

  if (query.status !== "ALL") {
    clauses.push({ status: query.status });
  }
  if (query.categoryId) {
    clauses.push({ categoryId: query.categoryId });
  }
  if (query.marketplaceId) {
    clauses.push({ affiliateLinks: { some: { marketplaceId: query.marketplaceId } } });
  }
  if (query.featured) {
    clauses.push({ isFeatured: true });
  }
  if (query.trending) {
    clauses.push({ isTrending: true });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

const adminListInclude = {
  category: { select: { name: true } },
  affiliateLinks: { include: { marketplace: { select: { name: true } } } },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }],
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ProductInclude;

export async function queryProductsAdmin(query: ProductAdminQuery): Promise<ProductAdminListResult> {
  const where = buildAdminWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { [query.sort]: query.dir },
      skip,
      take: query.pageSize,
      include: adminListInclude,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  return {
    products: products.map(toAdminRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount,
  };
}

/** Compact recent-product list for the dashboard — never loads the full catalog. */
export async function listRecentProductsAdmin(limit = 5): Promise<ProductAdminRow[]> {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: adminListInclude,
  });

  return products.map(toAdminRow);
}

export async function listMarketplaces() {
  return prisma.marketplace.findMany({ orderBy: { name: "asc" } });
}

export async function listCategoriesForSelect() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getProductByIdAdmin(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      affiliateLinks: { include: { marketplace: { select: { name: true, code: true } } } },
      images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
    },
  });
}

export async function isProductSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({ where: { slug } });
  return Boolean(existing && existing.id !== excludeId);
}

export interface ProductFieldsInput {
  title: string;
  slug: string;
  brand: string;
  categoryId: string;
  shortDescription: string;
  longDescription: string;
  status: ProductStatus;
  isFeatured: boolean;
  isTrending: boolean;
  currency: string;
  displayPrice: number;
  originalPrice: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
}

export interface AffiliateLinkInput {
  marketplaceId: string;
  marketplaceCode: MarketplaceCode;
  affiliateUrl: string;
  rawProductUrl: string;
  externalProductId: string;
  trackingTag: string | null;
  isActive: boolean;
  isPrimary: boolean;
}

/**
 * Creates or updates a product together with its per-marketplace affiliate
 * links and images in a single transaction. A link input with an empty
 * `affiliateUrl` means "no link for this marketplace" — any existing link
 * for that marketplace is removed.
 */
export async function saveProduct(
  productId: string | null,
  fields: ProductFieldsInput,
  links: AffiliateLinkInput[],
  images: ProductImageInput[],
  createdById?: string,
) {
  const discountPercentage = computeDiscountPercentage(fields.displayPrice, fields.originalPrice);
  const normalizedImages = normalizeImages(images);

  return prisma.$transaction(async (tx) => {
    const existing = productId
      ? await tx.product.findUnique({ where: { id: productId }, select: { publishedAt: true } })
      : null;

    const publishedAt =
      fields.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null);

    const product = productId
      ? await tx.product.update({
          where: { id: productId },
          data: {
            ...fields,
            discountPercentage,
            publishedAt,
          },
        })
      : await tx.product.create({
          data: {
            ...fields,
            discountPercentage,
            createdById,
            publishedAt,
          },
        });

    for (const link of links) {
      const hasUrl = link.affiliateUrl.trim().length > 0;

      if (!hasUrl) {
        await tx.affiliateLink.deleteMany({
          where: { productId: product.id, marketplaceId: link.marketplaceId },
        });
        continue;
      }

      await tx.affiliateLink.upsert({
        where: { productId_marketplaceId: { productId: product.id, marketplaceId: link.marketplaceId } },
        create: {
          productId: product.id,
          marketplaceId: link.marketplaceId,
          affiliateUrl: link.affiliateUrl.trim(),
          rawProductUrl: link.rawProductUrl.trim() || link.affiliateUrl.trim(),
          externalProductId: link.externalProductId.trim() || product.slug,
          trackingTag: link.trackingTag?.trim() || null,
          isActive: link.isActive,
          isPrimary: link.isPrimary,
        },
        update: {
          affiliateUrl: link.affiliateUrl.trim(),
          rawProductUrl: link.rawProductUrl.trim() || link.affiliateUrl.trim(),
          externalProductId: link.externalProductId.trim() || product.slug,
          trackingTag: link.trackingTag?.trim() || null,
          isActive: link.isActive,
          isPrimary: link.isPrimary,
        },
      });
    }

    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (normalizedImages.length > 0) {
      await tx.productImage.createMany({
        data: normalizedImages.map((image, index) => ({
          productId: product.id,
          url: image.url,
          altText: image.altText || null,
          position: index,
          isPrimary: image.isPrimary,
        })),
      });
    }

    return product;
  });
}

function normalizeImages(images: ProductImageInput[]): ProductImageInput[] {
  const cleaned = images.filter((image) => image.url.trim().length > 0);
  const primaryIndex = cleaned.findIndex((image) => image.isPrimary);
  return cleaned.map((image, index) => ({
    url: image.url.trim(),
    altText: image.altText.trim(),
    isPrimary: (primaryIndex === -1 ? 0 : primaryIndex) === index,
  }));
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export async function setProductStatus(id: string, status: ProductStatus) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { publishedAt: true } });

  return prisma.product.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt,
    },
  });
}

export async function bulkSetProductStatus(ids: string[], status: Extract<ProductStatus, "PUBLISHED" | "DRAFT">) {
  if (ids.length === 0) {
    return [];
  }

  if (status === "PUBLISHED") {
    const now = new Date();
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { id: { in: ids }, publishedAt: null },
        data: { status: "PUBLISHED", publishedAt: now },
      }),
      prisma.product.updateMany({
        where: { id: { in: ids }, NOT: { publishedAt: null } },
        data: { status: "PUBLISHED" },
      }),
    ]);
  } else {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: "DRAFT" },
    });
  }

  return prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, title: true, status: true },
  });
}

export async function setProductFlag(id: string, flag: "isFeatured" | "isTrending", value: boolean) {
  return prisma.product.update({ where: { id }, data: { [flag]: value } });
}

const previewInclude = {
  category: true,
  images: { orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }] },
  affiliateLinks: {
    where: { isActive: true },
    include: { marketplace: true },
    orderBy: { isPrimary: "desc" as const },
  },
} satisfies Prisma.ProductInclude;

/**
 * Admin-only preview in the public view-model shape. Unlike catalog reads,
 * this returns draft and archived products. Never call from a public route.
 */
export async function getProductPreviewById(id: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: previewInclude,
  });

  if (!product) {
    return null;
  }

  const categoryProductCount = await prisma.product.count({
    where: { categoryId: product.categoryId, status: "PUBLISHED" },
  });

  const category: CategorySummary = {
    id: product.category.id,
    slug: product.category.slug,
    name: product.category.name,
    description: product.category.description,
    productCount: categoryProductCount,
  };

  const marketplaces: MarketplaceLink[] = product.affiliateLinks.map((link) => ({
    marketplace: link.marketplace.code,
    label: link.marketplace.name,
    href: `/out/${link.id}`,
  }));

  const imageUrl = product.images[0]?.url ?? product.ogImageUrl ?? null;

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    category,
    status: product.status,
    shortDescription: product.shortDescription,
    currency: product.currency,
    displayPrice: Number(product.displayPrice),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
    rating: Number(product.rating),
    ratingCount: product.ratingCount,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    imageUrl,
    marketplaces,
    publishedAt: (product.publishedAt ?? product.createdAt).toISOString(),
    longDescription: product.longDescription,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    ogImageUrl: product.ogImageUrl ?? imageUrl,
  };
}
