import { prisma } from "@/lib/prisma";
import { ctr } from "@/lib/analytics-attribution";
import { analyticsQueryString, countryDetailHref, hasAnalyticsFilters, type AnalyticsQueryFilters } from "@/lib/analytics-query";
import { eachUtcDay, formatIsoDate, type ResolvedDateRange } from "@/lib/date-range";
import {
  getCountryAnalytics,
  getRetailerAnalytics,
  getSearchAnalytics,
  getTimeSeriesAnalytics,
} from "@/server/services/analytics-reports.service";
import { getMarketingViewsByProductIds } from "@/server/services/marketing-video.service";
import type {
  AnalyticsKpis,
  DashboardAnalytics,
  RankedRow,
  SeriesPoint,
} from "@/server/services/analytics-types";

export type { AnalyticsKpis, DashboardAnalytics, RankedRow, SeriesPoint };

type DayCount = { day: Date; count: number };
type NamedCount = { key: string | null; views: number; clicks: number };

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

function rankedFromNamed(rows: NamedCount[], fallbackLabel: string): RankedRow[] {
  return rows.map((row, index) => ({
    id: row.key?.trim() || `${fallbackLabel}-${index}`,
    label: row.key?.trim() || fallbackLabel,
    views: Number(row.views),
    clicks: Number(row.clicks),
  }));
}

export async function getDashboardAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
): Promise<DashboardAnalytics> {
  const createdAt = inRange(range.start, range.end);
  const filtered = hasAnalyticsFilters(filters);

  const [
    pageViews,
    productViews,
    categoryViews,
    searches,
    affiliateClicks,
    outboundClicks,
    uniqueVisitorRows,
    pageViewDays,
    productViewDays,
    clickDays,
    viewsByProduct,
    clicksByProduct,
    categoryViewRows,
    viewsByCategoryFallback,
    clicksByCategory,
    eventSourceRows,
    eventCampaignRows,
    utmSourceRows,
    utmCampaignRows,
    searchRows,
    deviceRows,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt } }),
    filtered
      ? prisma.analyticsEvent.count({ where: { type: "PRODUCT_VIEW", createdAt, country: filters.country ?? undefined, sourceNormalized: filters.source ?? undefined, utmMedium: filters.medium ?? undefined, utmCampaign: filters.campaign ?? undefined } })
      : prisma.productView.count({ where: { createdAt } }),
    prisma.analyticsEvent.count({ where: { type: "CATEGORY_VIEW", createdAt } }),
    prisma.analyticsEvent.count({ where: { type: "SEARCH", createdAt } }),
    filtered
      ? prisma.analyticsEvent.count({ where: { type: "AFFILIATE_CLICK", createdAt, country: filters.country ?? undefined, sourceNormalized: filters.source ?? undefined, utmMedium: filters.medium ?? undefined, utmCampaign: filters.campaign ?? undefined } })
      : prisma.affiliateClick.count({ where: { createdAt } }),
    prisma.analyticsEvent.count({ where: { type: "OUTBOUND_CLICK", createdAt } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT DISTINCT "visitorId" AS id
        FROM "analytics_events"
        WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        UNION
        SELECT DISTINCT "anonymousId" AS id
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
      ) visitors
    `,
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "analytics_events"
      WHERE type = 'PAGE_VIEW' AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
      GROUP BY 1
      ORDER BY 1
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
      SELECT "categoryId", COUNT(*)::int AS count
      FROM "analytics_events"
      WHERE type = 'CATEGORY_VIEW'
        AND "categoryId" IS NOT NULL
        AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
      GROUP BY "categoryId"
    `,
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
    prisma.$queryRaw<NamedCount[]>`
      SELECT "utmSource" AS key,
        COUNT(*) FILTER (WHERE type IN ('PAGE_VIEW', 'PRODUCT_VIEW', 'CATEGORY_VIEW'))::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events"
      WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
      GROUP BY "utmSource"
      ORDER BY views DESC, clicks DESC
      LIMIT 8
    `,
    prisma.$queryRaw<NamedCount[]>`
      SELECT "utmCampaign" AS key,
        COUNT(*) FILTER (WHERE type IN ('PAGE_VIEW', 'PRODUCT_VIEW', 'CATEGORY_VIEW'))::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events"
      WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        AND "utmCampaign" IS NOT NULL AND "utmCampaign" <> ''
      GROUP BY "utmCampaign"
      ORDER BY views DESC, clicks DESC
      LIMIT 8
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
    prisma.$queryRaw<Array<{ query: string; count: number }>>`
      SELECT "searchQuery" AS query, COUNT(*)::int AS count
      FROM "analytics_events"
      WHERE type = 'SEARCH'
        AND "searchQuery" IS NOT NULL
        AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
      GROUP BY "searchQuery"
      ORDER BY count DESC
      LIMIT 8
    `,
    prisma.$queryRaw<NamedCount[]>`
      SELECT CAST("deviceType" AS text) AS key,
        COUNT(*) FILTER (WHERE type IN ('PAGE_VIEW', 'PRODUCT_VIEW', 'CATEGORY_VIEW'))::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events"
      WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
      GROUP BY "deviceType"
      ORDER BY views DESC
    `,
  ]);

  const uniqueVisitors = Number(uniqueVisitorRows[0]?.count ?? 0);

  const [sessionRows, countries, retailers, searchReport, seriesExtra] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "sessionId")::int AS count
      FROM "analytics_events"
      WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        AND "sessionId" IS NOT NULL
    `,
    getCountryAnalytics(range, filters, 8),
    getRetailerAnalytics(range, filters, 8),
    getSearchAnalytics(range, filters, 8),
    getTimeSeriesAnalytics(range, filters),
  ]);

  const sessions = Number(sessionRows[0]?.count ?? 0);
  const affiliateCtr = ctr(affiliateClicks, productViews);
  const viewsByCategory = categoryViewRows.length > 0 ? categoryViewRows : viewsByCategoryFallback;

  const productIds = [...new Set([...viewsByProduct.map((row) => row.productId), ...clicksByProduct.map((row) => row.productId)])];
  const categoryIds = [...new Set([...viewsByCategory.map((row) => row.categoryId), ...clicksByCategory.map((row) => row.categoryId)])];

  const [products, categories, marketingViewsByProduct] = await Promise.all([
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
    getMarketingViewsByProductIds(productIds),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const clicksByProductId = new Map(clicksByProduct.map((row) => [row.productId, row._count.id]));
  const clicksByCategoryId = new Map(clicksByCategory.map((row) => [row.categoryId, row.count]));

  const topProducts = viewsByProduct
    .map((row) => {
      const product = productById.get(row.productId);
      const marketing = marketingViewsByProduct.get(row.productId);
      return {
        id: row.productId,
        label: product?.title ?? "Deleted product",
        href: `/admin/products/${row.productId}/analytics`,
        views: row._count.id,
        clicks: clicksByProductId.get(row.productId) ?? 0,
        marketingViews: marketing?.total ?? 0,
        platformViews: {
          INSTAGRAM: marketing?.INSTAGRAM ?? 0,
          FACEBOOK: marketing?.FACEBOOK ?? 0,
          YOUTUBE: marketing?.YOUTUBE ?? 0,
          TIKTOK: marketing?.TIKTOK ?? 0,
        },
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

  const topSources =
    eventSourceRows.some((row) => row.views + row.clicks > 0)
      ? rankedFromNamed(eventSourceRows, "(direct)")
      : utmSourceRows.map((row, index) => ({
          id: row.source ?? `direct-${index}`,
          label: row.source?.trim() || "(direct)",
          views: row.count,
          clicks: 0,
        }));

  const topCampaigns =
    eventCampaignRows.some((row) => row.views + row.clicks > 0)
      ? rankedFromNamed(eventCampaignRows, "(none)")
      : utmCampaignRows.map((row, index) => ({
          id: row.campaign ?? `campaign-${index}`,
          label: row.campaign ?? "(none)",
          views: row.count,
          clicks: 0,
        }));

  const deviceLabels: Record<string, string> = {
    DESKTOP: "Desktop",
    MOBILE: "Mobile",
    TABLET: "Tablet",
  };

  const viewMap = toCountMap(pageViews > 0 ? pageViewDays : productViewDays);
  const clickMap = toCountMap(clickDays);
  const series = eachUtcDay(range.start, range.end).map((date) => {
    const extra = seriesExtra.find((point) => point.date === date);
    return {
      date,
      views: extra?.views ?? viewMap.get(date) ?? 0,
      clicks: extra?.clicks ?? clickMap.get(date) ?? 0,
      visitors: extra?.visitors ?? 0,
      sessions: extra?.sessions ?? 0,
    };
  });

  const topCountries: RankedRow[] = countries.map((row) => ({
    id: row.id,
    label: row.label,
    href: countryDetailHref(row.id, range, filters),
    views: row.views,
    clicks: row.clicks,
    visitors: row.visitors,
    sessions: row.sessions,
    ctr: row.ctr,
  }));

  const topRetailers: RankedRow[] = retailers.map((row) => ({
    id: row.id,
    label: row.label,
    href: "/admin/analytics/retailers",
    views: row.views,
    clicks: row.clicks,
    visitors: row.visitors,
    ctr: row.ctr,
  }));

  return {
    range,
    kpis: {
      pageViews,
      productViews,
      categoryViews,
      searches,
      uniqueVisitors,
      sessions,
      affiliateClicks,
      outboundClicks,
      affiliateCtr,
    },
    topProducts,
    topCategories,
    topSources,
    topCampaigns,
    topSearches: searchRows.map((row) => ({
      id: row.query,
      label: row.query,
      views: row.count,
      clicks: 0,
    })),
    topCountries,
    topRetailers,
    opportunities: searchReport.opportunities.map((row) => ({
      id: row.id,
      label: row.label,
      href: `/admin/analytics/searches${analyticsQueryString(range, filters)}`,
      views: row.views,
      clicks: 0,
      visitors: row.visitors,
    })),
    devices: deviceRows.map((row) => ({
      id: row.key ?? "unknown",
      label: row.key ? (deviceLabels[row.key] ?? row.key) : "Unknown",
      views: Number(row.views),
      clicks: Number(row.clicks),
    })),
    series,
    hasData:
      pageViews +
        productViews +
        categoryViews +
        searches +
        affiliateClicks +
        outboundClicks +
        uniqueVisitors +
        sessions +
        topSources.length +
        topCampaigns.length +
        topCountries.length +
        topRetailers.length >
      0,
  };
}

export async function getProductAnalyticsSummary(productId: string, range: ResolvedDateRange) {
  const createdAt = inRange(range.start, range.end);

  const [views, clicks, uniqueRows] = await Promise.all([
    prisma.productView.count({ where: { productId, createdAt } }),
    prisma.affiliateClick.count({ where: { productId, createdAt } }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "visitorId")::int AS count
      FROM "analytics_events"
      WHERE "productId" = ${productId}
        AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
    `,
  ]);

  return {
    views,
    clicks,
    uniqueVisitors: Number(uniqueRows[0]?.count ?? 0),
    ctr: ctr(clicks, views),
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
