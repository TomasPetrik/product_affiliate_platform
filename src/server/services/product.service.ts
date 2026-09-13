import type { MarketplaceCode, ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

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
  updatedAt: Date;
}

export async function listProductsAdmin(): Promise<ProductAdminRow[]> {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      category: { select: { name: true } },
      affiliateLinks: { include: { marketplace: { select: { name: true } } } },
    },
  });

  return products.map((product) => ({
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
    updatedAt: product.updatedAt,
  }));
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
    include: { affiliateLinks: true },
  });
}

export async function isProductSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({ where: { slug } });
  return Boolean(existing && existing.id !== excludeId);
}

export interface ProductFieldsInput {
  title: string;
  slug: string;
  brand: string | null;
  categoryId: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  status: ProductStatus;
  isFeatured: boolean;
  isTrending: boolean;
  currency: string;
  displayPrice: number | null;
  originalPrice: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface AffiliateLinkInput {
  marketplaceId: string;
  marketplaceCode: MarketplaceCode;
  affiliateUrl: string;
  rawProductUrl: string;
  externalProductId: string;
  trackingTag: string | null;
  isActive: boolean;
}

/**
 * Creates or updates a product together with its per-marketplace affiliate
 * links in a single transaction. A link input with an empty `affiliateUrl`
 * means "no link for this marketplace" — any existing link for that
 * marketplace is removed.
 */
export async function saveProduct(
  productId: string | null,
  fields: ProductFieldsInput,
  links: AffiliateLinkInput[],
  createdById?: string,
) {
  return prisma.$transaction(async (tx) => {
    const product = productId
      ? await tx.product.update({
          where: { id: productId },
          data: {
            ...fields,
            publishedAt: fields.status === "PUBLISHED" ? new Date() : undefined,
          },
        })
      : await tx.product.create({
          data: {
            ...fields,
            createdById,
            publishedAt: fields.status === "PUBLISHED" ? new Date() : null,
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
        },
        update: {
          affiliateUrl: link.affiliateUrl.trim(),
          rawProductUrl: link.rawProductUrl.trim() || link.affiliateUrl.trim(),
          externalProductId: link.externalProductId.trim() || product.slug,
          trackingTag: link.trackingTag?.trim() || null,
          isActive: link.isActive,
        },
      });
    }

    return product;
  });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export async function setProductStatus(id: string, status: ProductStatus) {
  return prisma.product.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : undefined,
    },
  });
}

export async function setProductFlag(id: string, flag: "isFeatured" | "isTrending", value: boolean) {
  return prisma.product.update({ where: { id }, data: { [flag]: value } });
}
