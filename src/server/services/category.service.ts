import { prisma } from "@/lib/prisma";

export interface CategoryAdminRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
}

export async function listCategoriesAdmin(): Promise<CategoryAdminRow[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    productCount: category._count.products,
  }));
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export async function createCategory(input: CategoryInput) {
  return prisma.category.create({ data: input });
}

export async function updateCategory(id: string, input: CategoryInput) {
  return prisma.category.update({ where: { id }, data: input });
}

export async function deleteCategory(id: string) {
  return prisma.category.delete({ where: { id } });
}

export async function isCategorySlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.category.findUnique({ where: { slug } });
  return Boolean(existing && existing.id !== excludeId);
}
