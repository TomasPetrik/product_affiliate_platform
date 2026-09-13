import { prisma } from "@/lib/prisma";

/**
 * Read-only catalog of Prisma tables the admin database browser may show.
 * Password hashes are stripped before rows leave this module.
 */
export const DATABASE_TABLES = [
  { key: "products", label: "Products", description: "Catalog products and publish flags" },
  { key: "categories", label: "Categories", description: "Public category taxonomy" },
  { key: "affiliate_links", label: "Affiliate links", description: "Per-marketplace outbound URLs" },
  { key: "marketplaces", label: "Marketplaces", description: "Amazon, eBay, and other retailers" },
  { key: "product_images", label: "Product images", description: "Image URLs attached to products" },
  { key: "admin_users", label: "Admin users", description: "Dashboard accounts (password hashes hidden)" },
  { key: "audit_logs", label: "Audit logs", description: "Who changed what, and when" },
] as const;

export type DatabaseTableKey = (typeof DATABASE_TABLES)[number]["key"];

const TABLE_KEYS = new Set<string>(DATABASE_TABLES.map((table) => table.key));

export function isDatabaseTableKey(value: string): value is DatabaseTableKey {
  return TABLE_KEYS.has(value);
}

export interface DatabaseTableSummary {
  key: DatabaseTableKey;
  label: string;
  description: string;
  rowCount: number;
}

export async function listDatabaseTables(): Promise<DatabaseTableSummary[]> {
  const [products, categories, affiliateLinks, marketplaces, productImages, adminUsers, auditLogs] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.affiliateLink.count(),
      prisma.marketplace.count(),
      prisma.productImage.count(),
      prisma.adminUser.count(),
      prisma.auditLog.count(),
    ]);

  const counts: Record<DatabaseTableKey, number> = {
    products,
    categories,
    affiliate_links: affiliateLinks,
    marketplaces,
    product_images: productImages,
    admin_users: adminUsers,
    audit_logs: auditLogs,
  };

  return DATABASE_TABLES.map((table) => ({
    ...table,
    rowCount: counts[table.key],
  }));
}

export interface DatabaseTablePage {
  key: DatabaseTableKey;
  label: string;
  description: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  rowCount: number;
}

const SENSITIVE_KEYS = new Set(["passwordHash"]);

function toDisplayRow(record: Record<string, unknown>): Record<string, string> {
  const row: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEYS.has(key)) {
      row[key] = "••••••••";
      continue;
    }

    if (value === null || value === undefined) {
      row[key] = "";
      continue;
    }

    if (value instanceof Date) {
      row[key] = value.toISOString();
      continue;
    }

    if (typeof value === "object") {
      row[key] = JSON.stringify(value);
      continue;
    }

    row[key] = String(value);
  }

  return row;
}

async function loadTableRecords(key: DatabaseTableKey): Promise<Record<string, unknown>[]> {
  switch (key) {
    case "products":
      return prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    case "categories":
      return prisma.category.findMany({ orderBy: { sortOrder: "asc" }, take: 200 });
    case "affiliate_links":
      return prisma.affiliateLink.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    case "marketplaces":
      return prisma.marketplace.findMany({ orderBy: { name: "asc" }, take: 200 });
    case "product_images":
      return prisma.productImage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    case "admin_users":
      return prisma.adminUser.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        omit: { passwordHash: true },
      });
    case "audit_logs":
      return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  }
}

export async function getDatabaseTablePage(key: DatabaseTableKey): Promise<DatabaseTablePage> {
  const meta = DATABASE_TABLES.find((table) => table.key === key);
  if (!meta) {
    throw new Error(`Unknown table: ${key}`);
  }

  const [records, rowCount] = await Promise.all([loadTableRecords(key), countForKey(key)]);
  const displayRows = records.map((record) => toDisplayRow(record as Record<string, unknown>));
  const columns = displayRows[0] ? Object.keys(displayRows[0]) : [];

  return {
    key,
    label: meta.label,
    description: meta.description,
    columns,
    rows: displayRows,
    rowCount,
  };
}

async function countForKey(key: DatabaseTableKey): Promise<number> {
  switch (key) {
    case "products":
      return prisma.product.count();
    case "categories":
      return prisma.category.count();
    case "affiliate_links":
      return prisma.affiliateLink.count();
    case "marketplaces":
      return prisma.marketplace.count();
    case "product_images":
      return prisma.productImage.count();
    case "admin_users":
      return prisma.adminUser.count();
    case "audit_logs":
      return prisma.auditLog.count();
  }
}
