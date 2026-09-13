import { prisma } from "@/lib/prisma";

export async function listMarketplacesAdmin() {
  return prisma.marketplace.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { affiliateLinks: true, productImports: true, revenueEntries: true } },
    },
  });
}

export interface MarketplaceUpdateInput {
  name: string;
  baseUrl: string;
  logoUrl: string | null;
  isActive: boolean;
}

export async function updateMarketplace(id: string, data: MarketplaceUpdateInput) {
  return prisma.marketplace.update({
    where: { id },
    data,
  });
}
