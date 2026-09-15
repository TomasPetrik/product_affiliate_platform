import { Prisma } from "@/generated/prisma/client";
import { affiliateGoHref } from "@/lib/affiliate-go";
import { categoryCoverImage } from "@/lib/category-images";
import { prisma } from "@/lib/prisma";
import type { CategorySummary, MarketplaceLink, ProductDetail, ProductStatus, ProductSummary } from "@/types/catalog";

/**
 * Public-facing catalog reads, backed by Prisma. Every function here only
 * ever returns `PUBLISHED` products — draft/archived content must never
 * leak onto the public site. Admin-facing reads (all statuses) live
 * separately in `src/server/services/product.service.ts` /
 * `category.service.ts`.
 *
 * Return shapes intentionally match the `ProductSummary`/`CategorySummary`
 * view models the public UI components were already built against (see
 * `src/types/catalog.ts`), so this module is a drop-in replacement for the
 * Phase 1 `src/lib/placeholder-data.ts`.
 */

const productInclude = {
  category: true,
  images: { orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }] },
  affiliateLinks: {
    where: { isActive: true },
    include: { marketplace: true },
    orderBy: { isPrimary: "desc" as const },
  },
};

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toMarketplaceLinks(product: ProductWithRelations): MarketplaceLink[] {
  return product.affiliateLinks.flatMap((link) => {
    if (!link.marketplace) return [];
    return [
      {
        id: link.id,
        marketplace: link.marketplace.code,
        label: link.marketplace.name,
        href: affiliateGoHref(product.slug, link.marketplace.code, link.id),
        price: link.lastKnownPrice ? Number(link.lastKnownPrice) : null,
        currency: link.lastKnownPriceCurrency ?? product.currency,
        availability: link.lastKnownAvailability,
      },
    ];
  });
}

function toCategorySummary(
  category: { id: string; slug: string; name: string; description: string | null; imageUrl?: string | null } | null,
  productCount: number,
): CategorySummary {
  if (!category) {
    return {
      id: "uncategorized",
      slug: "uncategorized",
      name: "Uncategorized",
      description: "",
      productCount,
      imageUrl: null,
    };
  }

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? "",
    productCount,
    imageUrl: categoryCoverImage(category.slug, category.imageUrl),
  };
}

function toProductSummary(product: ProductWithRelations, categoryProductCount: number): ProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand ?? "",
    category: toCategorySummary(product.category, categoryProductCount),
    status: product.status as ProductStatus,
    shortDescription: product.shortDescription ?? "",
    currency: product.currency,
    displayPrice: product.displayPrice ? Number(product.displayPrice) : 0,
    originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
    rating: product.rating ? Number(product.rating) : 0,
    ratingCount: product.ratingCount,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    imageUrl: product.images[0]?.url ?? product.ogImageUrl ?? null,
    marketplaces: toMarketplaceLinks(product),
    publishedAt: product.publishedAt ? product.publishedAt.toISOString() : product.createdAt.toISOString(),
  };
}

function toProductDetail(product: ProductWithRelations, categoryProductCount: number): ProductDetail {
  const summary = toProductSummary(product, categoryProductCount);
  return {
    ...summary,
    longDescription: product.longDescription ?? product.shortDescription ?? "",
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    ogImageUrl: product.ogImageUrl ?? summary.imageUrl,
  };
}

async function countPublishedInCategory(categoryId: string | null): Promise<number> {
  if (!categoryId) return 0;
  return prisma.product.count({ where: { categoryId, status: "PUBLISHED" } });
}

async function toSummaries(products: ProductWithRelations[]): Promise<ProductSummary[]> {
  const counts = new Map<string, number>();
  const categoryIds = [...new Set(products.map((product) => product.categoryId).filter((id): id is string => Boolean(id)))];

  await Promise.all(
    categoryIds.map(async (categoryId) => {
      counts.set(categoryId, await countPublishedInCategory(categoryId));
    }),
  );

  return products.map((product) => toProductSummary(product, counts.get(product.categoryId ?? "") ?? 0));
}

export async function getAllCategories(): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? "",
    productCount: category._count.products,
    imageUrl: categoryCoverImage(category.slug, category.imageUrl),
  }));
}

export async function getCategoryBySlug(slug: string): Promise<CategorySummary | undefined> {
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    include: {
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
    },
  });

  if (!category) return undefined;

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? "",
    productCount: category._count.products,
    imageUrl: categoryCoverImage(category.slug, category.imageUrl),
  };
}

export async function getAllProducts(): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | undefined> {
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: productInclude,
  });

  if (!product) return undefined;

  return toProductDetail(product, await countPublishedInCategory(product.categoryId));
}

export async function getFeaturedProducts(limit = 4): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getTrendingProducts(limit = 4): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", isTrending: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getBestSellerProducts(limit = 4): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", ratingCount: { gt: 0 } },
    orderBy: [{ ratingCount: "desc" }, { rating: "desc" }],
    take: limit,
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getNewProducts(limit = 4): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getProductsUnderPrice(maxPrice: number, limit = 4): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      displayPrice: { gt: 0, lte: maxPrice },
    },
    orderBy: { displayPrice: "asc" },
    take: limit,
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getProductsByCategorySlug(slug: string): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", category: { slug } },
    orderBy: { publishedAt: "desc" },
    include: productInclude,
  });

  return toSummaries(products);
}

export async function searchProducts(query: string): Promise<ProductSummary[]> {
  const normalized = query.trim();

  if (!normalized) {
    return getAllProducts();
  }

  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: normalized, mode: "insensitive" } },
        { brand: { contains: normalized, mode: "insensitive" } },
        { shortDescription: { contains: normalized, mode: "insensitive" } },
        { category: { name: { contains: normalized, mode: "insensitive" } } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    include: productInclude,
  });

  return toSummaries(products);
}

export async function getRelatedProducts(product: ProductSummary, limit = 4): Promise<ProductSummary[]> {
  const related = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      slug: { not: product.slug },
      category: { slug: product.category.slug },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: productInclude,
  });

  return toSummaries(related);
}
