import { env } from "@/lib/env";
import { formatIsoDate } from "@/lib/date-range";
import { prisma } from "@/lib/prisma";

type MetricRow = {
  dimension: "OVERALL" | "COUNTRY" | "SOURCE" | "CAMPAIGN" | "PRODUCT" | "RETAILER" | "DEVICE" | "SEARCH";
  key: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  productViews: number;
  offerViews: number;
  affiliateClicks: number;
  searches: number;
  zeroResultSearches: number;
  searchResultClicks: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

async function loadDayMetrics(start: Date, end: Date): Promise<MetricRow[]> {
  const rows = await prisma.$queryRaw<MetricRow[]>`
    SELECT dimension, key,
      visitors, sessions, "pageViews", "productViews", "offerViews",
      "affiliateClicks", searches, "zeroResultSearches", "searchResultClicks"
    FROM (
      SELECT 'OVERALL'::text AS dimension, '' AS key,
        COUNT(DISTINCT "visitorId")::int AS visitors,
        COUNT(DISTINCT "sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int AS "pageViews",
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS "productViews",
        COUNT(*) FILTER (WHERE type = 'RETAILER_OFFER_VIEW')::int AS "offerViews",
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS "affiliateClicks",
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int AS searches,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int AS "zeroResultSearches",
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int AS "searchResultClicks"
      FROM "analytics_events"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}

      UNION ALL
      SELECT 'COUNTRY', COALESCE("country", ''),
        COUNT(DISTINCT "visitorId")::int, COUNT(DISTINCT "sessionId")::int,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'RETAILER_OFFER_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int
      FROM "analytics_events"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY "country"

      UNION ALL
      SELECT 'SOURCE', COALESCE(NULLIF("sourceNormalized", ''), 'Direct'),
        COUNT(DISTINCT "visitorId")::int, COUNT(DISTINCT "sessionId")::int,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'RETAILER_OFFER_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int
      FROM "analytics_events"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY 2

      UNION ALL
      SELECT 'CAMPAIGN', COALESCE("utmCampaign", ''),
        COUNT(DISTINCT "visitorId")::int, COUNT(DISTINCT "sessionId")::int,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'RETAILER_OFFER_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int
      FROM "analytics_events"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND "utmCampaign" IS NOT NULL AND "utmCampaign" <> ''
      GROUP BY "utmCampaign"

      UNION ALL
      SELECT 'PRODUCT', COALESCE("productId", ''),
        COUNT(DISTINCT "visitorId")::int, COUNT(DISTINCT "sessionId")::int,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'RETAILER_OFFER_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int
      FROM "analytics_events"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND "productId" IS NOT NULL
      GROUP BY "productId"

      UNION ALL
      SELECT 'DEVICE', COALESCE(CAST("deviceType" AS text), ''),
        COUNT(DISTINCT "visitorId")::int, COUNT(DISTINCT "sessionId")::int,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'RETAILER_OFFER_VIEW')::int,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int
      FROM "analytics_events"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY "deviceType"
    ) metrics
  `;

  const retailers = await prisma.$queryRaw<MetricRow[]>`
    SELECT 'RETAILER'::text AS dimension, m.id AS key,
      COUNT(DISTINCT e."visitorId")::int AS visitors,
      COUNT(DISTINCT e."sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE e.type = 'PAGE_VIEW')::int AS "pageViews",
      COUNT(*) FILTER (WHERE e.type = 'PRODUCT_VIEW')::int AS "productViews",
      COUNT(*) FILTER (WHERE e.type = 'RETAILER_OFFER_VIEW')::int AS "offerViews",
      COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS "affiliateClicks",
      COUNT(*) FILTER (WHERE e.type = 'SEARCH')::int AS searches,
      COUNT(*) FILTER (WHERE e.type = 'NO_SEARCH_RESULTS')::int AS "zeroResultSearches",
      COUNT(*) FILTER (WHERE e.type = 'SEARCH_RESULT_CLICK')::int AS "searchResultClicks"
    FROM "analytics_events" e
    JOIN "affiliate_links" l ON l.id = e."affiliateLinkId"
    JOIN "marketplaces" m ON m.id = l."marketplaceId"
    WHERE e."createdAt" >= ${start} AND e."createdAt" <= ${end}
      AND e."affiliateLinkId" IS NOT NULL
    GROUP BY m.id
  `;

  const searches = await prisma.$queryRaw<MetricRow[]>`
    SELECT 'SEARCH'::text AS dimension, COALESCE("searchQuery", '') AS key,
      COUNT(DISTINCT "visitorId")::int AS visitors,
      COUNT(DISTINCT "sessionId")::int AS sessions,
      0 AS "pageViews",
      0 AS "productViews",
      0 AS "offerViews",
      COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS "affiliateClicks",
      COUNT(*) FILTER (WHERE type = 'SEARCH')::int AS searches,
      COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int AS "zeroResultSearches",
      COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int AS "searchResultClicks"
    FROM "analytics_events"
    WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      AND "searchQuery" IS NOT NULL
    GROUP BY "searchQuery"
  `;

  return [...rows, ...retailers, ...searches];
}

export async function rollupAnalyticsDay(day: Date): Promise<number> {
  const start = startOfUtcDay(day);
  const end = endOfUtcDay(day);
  const metrics = await loadDayMetrics(start, end);

  for (const metric of metrics) {
    await prisma.analyticsDailyMetric.upsert({
      where: {
        day_dimension_key: {
          day: start,
          dimension: metric.dimension,
          key: metric.key ?? "",
        },
      },
      create: {
        day: start,
        dimension: metric.dimension,
        key: metric.key ?? "",
        visitors: Number(metric.visitors),
        sessions: Number(metric.sessions),
        pageViews: Number(metric.pageViews),
        productViews: Number(metric.productViews),
        offerViews: Number(metric.offerViews),
        affiliateClicks: Number(metric.affiliateClicks),
        searches: Number(metric.searches),
        zeroResultSearches: Number(metric.zeroResultSearches),
        searchResultClicks: Number(metric.searchResultClicks),
      },
      update: {
        visitors: Number(metric.visitors),
        sessions: Number(metric.sessions),
        pageViews: Number(metric.pageViews),
        productViews: Number(metric.productViews),
        offerViews: Number(metric.offerViews),
        affiliateClicks: Number(metric.affiliateClicks),
        searches: Number(metric.searches),
        zeroResultSearches: Number(metric.zeroResultSearches),
        searchResultClicks: Number(metric.searchResultClicks),
      },
    });
  }

  return metrics.length;
}

export async function runAnalyticsRetention(now = new Date()) {
  const retentionDays = env.ANALYTICS_RETENTION_DAYS;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - retentionDays));

  let rolledUp = 0;
  const cursor = new Date(cutoff.getTime() - 2 * 24 * 60 * 60 * 1000);
  while (cursor.getTime() < cutoff.getTime()) {
    rolledUp += await rollupAnalyticsDay(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  rolledUp += await rollupAnalyticsDay(yesterday);

  const rolledDays = await prisma.analyticsDailyMetric.findMany({
    where: { dimension: "OVERALL", day: { lt: cutoff } },
    select: { day: true },
    distinct: ["day"],
  });

  let deletedEvents = 0;
  let deletedViews = 0;

  for (const row of rolledDays) {
    const start = startOfUtcDay(row.day);
    const end = endOfUtcDay(row.day);
    const [events, views] = await prisma.$transaction([
      prisma.analyticsEvent.deleteMany({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.productView.deleteMany({ where: { createdAt: { gte: start, lte: end } } }),
    ]);
    deletedEvents += events.count;
    deletedViews += views.count;
  }

  return {
    retentionDays,
    cutoff: formatIsoDate(cutoff),
    rolledUp,
    deletedEvents,
    deletedViews,
  };
}

export function analyticsRetentionCutoff(now = new Date(), days = env.ANALYTICS_RETENTION_DAYS): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));
}
