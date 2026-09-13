import { prisma } from "@/lib/prisma";
import { eachUtcDay, formatIsoDate, type ResolvedDateRange } from "@/lib/date-range";

export interface AnalyticsKpis {
  productViews: number;
  uniqueVisitors: number;
  affiliateClicks: number;
  affiliateCtr: number | null;
}

export interface RankedRow {
  id: string;
  label: string;
  href?: string;
  views: number;
  clicks: number;
}

export interface SeriesPoint {
  date: string;
  views: number;
  clicks: number;
}

export interface DashboardAnalytics {
  range: ResolvedDateRange;
  kpis: AnalyticsKpis;
  topProducts: RankedRow[];
  topCategories: RankedRow[];
  topSources: RankedRow[];
  topCampaigns: RankedRow[];
  series: SeriesPoint[];
  hasData: boolean;
}

type DayCount = { day: Date; count: number };

function inRange(start: Date, end: Date) {
  return { gte: start, lte: end };
}

function toCountMap(rows: DayCount[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.day instanceof Date ? formatIsoDate(row.day) : String(row.day).slice(0, 10);
    map.set(key, Number(row.count));
  }
  return map;
}

export async function getDashboardAnalytics(range: ResolvedDateRange): Promise<DashboardAnalytics> {
  const createdAt = inRange(range.start, range.end);

  const [productViews, affiliateClicks, uniqueVisitorRows, viewDays, clickDays, viewsByProduct, clicksByProduct, viewsByCategory, clicksByCategory, sourceRows, campaignRows] =
    await Promise.all([
      prisma.productView.count({ where: { createdAt } }),
      prisma.affiliateClick.count({ where: { createdAt } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "anonymousId")::bigint AS count
        FROM "traffic_sessions"
        WHERE id IN (
          SELECT "sessionId" FROM "product_views"
          WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end} AND "sessionId" IS NOT NULL
          UNION
          SELECT "sessionId" FROM "affiliate_clicks"
          WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end} AND "sessionId" IS NOT NULL
          UNION
          SELECT id FROM "traffic_sessions"
          WHERE "startedAt" >= ${range.start} AND "startedAt" <= ${range.end}
        )
      `,
      prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM "product_views"
        WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM "affiliate_clicks"
        WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.productView.groupBy({
        by: ["productId"],
        where: { createdAt },
        _count: { id: true },
      }),
      prisma.affiliateClick.groupBy({
        by: ["productId"],
        where: { createdAt },
        _count: { id: true },
      }),
      prisma.$queryRaw<Array<{ categoryId: string; count: number }>>`
        SELECT p."categoryId" AS "categoryId", COUNT(v.id)::int AS count
        FROM "product_views" v
        JOIN "products" p ON p.id = v."productId"
        WHERE v."createdAt" >= ${range.start} AND v."createdAt" <= ${range.end}
        GROUP BY p."categoryId"
      `,
      prisma.$queryRaw<Array<{ categoryId: string; count: number }>>`
        SELECT p."categoryId" AS "categoryId", COUNT(c.id)::int AS count
        FROM "affiliate_clicks" c
        JOIN "products" p ON p.id = c."productId"
        WHERE c."createdAt" >= ${range.start} AND c."createdAt" <= ${range.end}
        GROUP BY p."categoryId"
      `,
      prisma.$queryRaw<Array<{ source: string | null; count: number }>>`
        SELECT "source", COUNT(*)::int AS count
        FROM "utm_events"
        WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        GROUP BY "source"
        ORDER BY count DESC
        LIMIT 8
      `,
      prisma.$queryRaw<Array<{ campaign: string | null; count: number }>>`
        SELECT "campaign", COUNT(*)::int AS count
        FROM "utm_events"
        WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
          AND "campaign" IS NOT NULL AND "campaign" <> ''
        GROUP BY "campaign"
        ORDER BY count DESC
        LIMIT 8
      `,
    ]);

  const uniqueVisitors = Number(uniqueVisitorRows[0]?.count ?? 0);
  const affiliateCtr = productViews > 0 ? (affiliateClicks / productViews) * 100 : null;

  const productIds = [...new Set([...viewsByProduct.map((row) => row.productId), ...clicksByProduct.map((row) => row.productId)])];
  const categoryIds = [...new Set([...viewsByCategory.map((row) => row.categoryId), ...clicksByCategory.map((row) => row.categoryId)])];

  const [products, categories] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true, slug: true },
        })
      : Promise.resolve([]),
    categoryIds.length
      ? prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const clicksByProductId = new Map(clicksByProduct.map((row) => [row.productId, row._count.id]));
  const clicksByCategoryId = new Map(clicksByCategory.map((row) => [row.categoryId, row.count]));

  const topProducts = viewsByProduct
    .map((row) => {
      const product = productById.get(row.productId);
      return {
        id: row.productId,
        label: product?.title ?? "Deleted product",
        href: `/admin/products/${row.productId}`,
        views: row._count.id,
        clicks: clicksByProductId.get(row.productId) ?? 0,
      };
    })
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks)
    .slice(0, 8);

  const topCategories = viewsByCategory
    .map((row) => {
      const category = categoryById.get(row.categoryId);
      return {
        id: row.categoryId,
        label: category?.name ?? "Uncategorized",
        href: category ? `/admin/categories/${category.id}/edit` : undefined,
        views: row.count,
        clicks: clicksByCategoryId.get(row.categoryId) ?? 0,
      };
    })
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks)
    .slice(0, 8);

  const viewMap = toCountMap(viewDays);
  const clickMap = toCountMap(clickDays);
  const series = eachUtcDay(range.start, range.end).map((date) => ({
    date,
    views: viewMap.get(date) ?? 0,
    clicks: clickMap.get(date) ?? 0,
  }));

  return {
    range,
    kpis: {
      productViews,
      uniqueVisitors,
      affiliateClicks,
      affiliateCtr,
    },
    topProducts,
    topCategories,
    topSources: sourceRows.map((row, index) => ({
      id: row.source ?? `direct-${index}`,
      label: row.source?.trim() || "(direct)",
      views: row.count,
      clicks: 0,
    })),
    topCampaigns: campaignRows.map((row, index) => ({
      id: row.campaign ?? `campaign-${index}`,
      label: row.campaign ?? "(none)",
      views: row.count,
      clicks: 0,
    })),
    series,
    hasData: productViews + affiliateClicks + uniqueVisitors + sourceRows.length + campaignRows.length > 0,
  };
}

export async function getProductAnalyticsSummary(productId: string, range: ResolvedDateRange) {
  const createdAt = inRange(range.start, range.end);

  const [views, clicks] = await Promise.all([
    prisma.productView.count({ where: { productId, createdAt } }),
    prisma.affiliateClick.count({ where: { productId, createdAt } }),
  ]);

  return {
    views,
    clicks,
    ctr: views > 0 ? (clicks / views) * 100 : null,
  };
}

export async function listRevenueEntries() {
  return prisma.revenueEntry.findMany({
    orderBy: { occurredOn: "desc" },
    take: 100,
    include: {
      marketplace: { select: { name: true } },
      product: { select: { title: true } },
    },
  });
}
