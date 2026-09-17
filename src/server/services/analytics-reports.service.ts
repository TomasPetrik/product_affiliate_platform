import { Prisma } from "@/generated/prisma/client";

import { ctr } from "@/lib/analytics-attribution";
import { deviceLabel } from "@/lib/analytics-device";
import type { AnalyticsQueryFilters } from "@/lib/analytics-query";
import { cityDisplayName, countryDisplayName } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { eachUtcDay, formatIsoDate, type ResolvedDateRange } from "@/lib/date-range";
import type { RankedRow, SeriesPoint } from "@/server/services/analytics-types";

export interface ReportRow {
  id: string;
  label: string;
  href?: string;
  visitors: number;
  sessions: number;
  views: number;
  clicks: number;
  offerViews?: number;
  searches?: number;
  ctr: number | null;
}

export interface ProductOfferAnalytics {
  id: string;
  retailer: string;
  views: number;
  clicks: number;
  ctr: number | null;
}

export interface ProductAnalytics {
  productId: string;
  views: number;
  uniqueVisitors: number;
  sessions: number;
  affiliateClicks: number;
  ctr: number | null;
  countries: ReportRow[];
  sources: ReportRow[];
  campaigns: ReportRow[];
  offers: ProductOfferAnalytics[];
  searchQueries: ReportRow[];
  series: SeriesPoint[];
}

function countryEqualsSql(country: string | null | undefined) {
  if (!country) return null;
  if (country === "unknown") return Prisma.sql`e."country" IS NULL`;
  return Prisma.sql`e."country" = ${country}`;
}

function eventSql(range: ResolvedDateRange, filters: AnalyticsQueryFilters = {}, productId?: string) {
  const parts = [Prisma.sql`e."createdAt" >= ${range.start} AND e."createdAt" <= ${range.end}`];
  const country = countryEqualsSql(filters.country);
  if (country) parts.push(country);
  if (filters.source) parts.push(Prisma.sql`e."sourceNormalized" = ${filters.source}`);
  if (filters.medium) parts.push(Prisma.sql`e."utmMedium" = ${filters.medium}`);
  if (filters.campaign) parts.push(Prisma.sql`e."utmCampaign" = ${filters.campaign}`);
  if (productId) parts.push(Prisma.sql`e."productId" = ${productId}`);
  return Prisma.join(parts, " AND ");
}

function toReport(rows: Array<{ id: string; label: string; href?: string; visitors: number; sessions: number; views: number; clicks: number; offerViews?: number; searches?: number }>): ReportRow[] {
  return rows.map((row) => ({
    ...row,
    visitors: Number(row.visitors),
    sessions: Number(row.sessions),
    views: Number(row.views),
    clicks: Number(row.clicks),
    offerViews: row.offerViews == null ? undefined : Number(row.offerViews),
    searches: row.searches == null ? undefined : Number(row.searches),
    ctr: ctr(Number(row.clicks), Number(row.views)),
  }));
}

function rankedFromReport(rows: ReportRow[]): RankedRow[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    href: row.href,
    views: row.views,
    clicks: row.clicks,
    visitors: row.visitors,
    sessions: row.sessions,
    ctr: row.ctr,
  }));
}

export async function getCountryAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  limit = 50,
): Promise<ReportRow[]> {
  const where = eventSql(range, { ...filters, country: undefined });
  const rows = await prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
    SELECT "country" AS key,
      COUNT(DISTINCT "visitorId")::int AS visitors,
      COUNT(DISTINCT "sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    WHERE ${where}
    GROUP BY "country"
    ORDER BY visitors DESC, views DESC
    LIMIT ${limit}
  `;

  return toReport(
    rows.map((row) => {
      const code = row.key?.trim() || "unknown";
      return {
        id: code,
        label: countryDisplayName(row.key),
        href: undefined,
        visitors: row.visitors,
        sessions: row.sessions,
        views: row.views,
        clicks: row.clicks,
      };
    }),
  );
}

export interface GeoClickRow {
  id: string;
  createdAt: Date;
  productId: string;
  productTitle: string;
  productHref: string;
  retailer: string;
  city: string;
}

export interface CountryAnalytics {
  country: string;
  label: string;
  visitors: number;
  sessions: number;
  views: number;
  clicks: number;
  ctr: number | null;
  cities: ReportRow[];
  products: ReportRow[];
  recentClicks: GeoClickRow[];
  series: Array<SeriesPoint & { visitors: number; sessions: number }>;
}

export async function getCountryDetailAnalytics(
  country: string,
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
): Promise<CountryAnalytics> {
  const scoped = { ...filters, country };
  const where = eventSql(range, scoped);

  const [kpis, cities, products, clicks, series] = await Promise.all([
    prisma.$queryRaw<Array<{ visitors: number; sessions: number; views: number; clicks: number }>>`
      SELECT
        COUNT(DISTINCT e."visitorId")::int AS visitors,
        COUNT(DISTINCT e."sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE e.type = 'PRODUCT_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
    `,
    prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
      SELECT e."city" AS key,
        COUNT(DISTINCT e."visitorId")::int AS visitors,
        COUNT(DISTINCT e."sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE e.type = 'PRODUCT_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
      GROUP BY e."city"
      ORDER BY visitors DESC, views DESC
      LIMIT 50
    `,
    prisma.$queryRaw<Array<{ id: string; title: string; views: number; clicks: number; visitors: number; sessions: number }>>`
      SELECT p.id, p.title,
        COUNT(DISTINCT e."visitorId")::int AS visitors,
        COUNT(DISTINCT e."sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE e.type = 'PRODUCT_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      JOIN "products" p ON p.id = e."productId"
      WHERE ${where}
        AND e."productId" IS NOT NULL
      GROUP BY p.id, p.title
      ORDER BY views DESC, clicks DESC
      LIMIT 50
    `,
    prisma.$queryRaw<Array<{ id: string; createdAt: Date; productId: string; title: string; retailer: string | null; city: string | null }>>`
      SELECT e.id, e."createdAt", p.id AS "productId", p.title,
        m.name AS retailer, e."city" AS city
      FROM "analytics_events" e
      JOIN "products" p ON p.id = e."productId"
      LEFT JOIN "affiliate_links" l ON l.id = e."affiliateLinkId"
      LEFT JOIN "marketplaces" m ON m.id = l."marketplaceId"
      WHERE ${where}
        AND e.type = 'AFFILIATE_CLICK'
      ORDER BY e."createdAt" DESC
      LIMIT 50
    `,
    getTimeSeriesAnalytics(range, scoped),
  ]);

  const kpi = kpis[0] ?? { visitors: 0, sessions: 0, views: 0, clicks: 0 };

  return {
    country,
    label: countryDisplayName(country === "unknown" ? null : country),
    visitors: Number(kpi.visitors),
    sessions: Number(kpi.sessions),
    views: Number(kpi.views),
    clicks: Number(kpi.clicks),
    ctr: ctr(Number(kpi.clicks), Number(kpi.views)),
    cities: toReport(
      cities.map((row) => ({
        id: row.key?.trim() || "unknown",
        label: cityDisplayName(row.key),
        visitors: row.visitors,
        sessions: row.sessions,
        views: row.views,
        clicks: row.clicks,
      })),
    ),
    products: toReport(
      products.map((row) => ({
        id: row.id,
        label: row.title,
        href: `/admin/products/${row.id}/analytics`,
        visitors: row.visitors,
        sessions: row.sessions,
        views: row.views,
        clicks: row.clicks,
      })),
    ),
    recentClicks: clicks.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      productId: row.productId,
      productTitle: row.title,
      productHref: `/admin/products/${row.productId}/analytics`,
      retailer: row.retailer || "Unknown retailer",
      city: cityDisplayName(row.city),
    })),
    series,
  };
}

export async function getSourceAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  limit = 50,
): Promise<ReportRow[]> {
  const where = eventSql(range, { ...filters, source: undefined });
  const rows = await prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
    SELECT COALESCE(NULLIF("sourceNormalized", ''), '(direct)') AS key,
      COUNT(DISTINCT "visitorId")::int AS visitors,
      COUNT(DISTINCT "sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    WHERE ${where}
    GROUP BY 1
    ORDER BY visitors DESC, views DESC
    LIMIT ${limit}
  `;

  return toReport(
    rows.map((row) => ({
      id: row.key || "direct",
      label: row.key === "(direct)" ? "Direct" : (row.key ?? "Direct"),
      visitors: row.visitors,
      sessions: row.sessions,
      views: row.views,
      clicks: row.clicks,
    })),
  );
}

export async function getCampaignAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  limit = 50,
): Promise<ReportRow[]> {
  const where = eventSql(range, { ...filters, campaign: undefined });
  const rows = await prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
    SELECT "utmCampaign" AS key,
      COUNT(DISTINCT "visitorId")::int AS visitors,
      COUNT(DISTINCT "sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    WHERE ${where}
      AND "utmCampaign" IS NOT NULL AND "utmCampaign" <> ''
    GROUP BY "utmCampaign"
    ORDER BY visitors DESC, views DESC
    LIMIT ${limit}
  `;

  return toReport(
    rows.map((row) => ({
      id: row.key || "none",
      label: row.key || "(none)",
      visitors: row.visitors,
      sessions: row.sessions,
      views: row.views,
      clicks: row.clicks,
    })),
  );
}

export async function getRetailerAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  limit = 50,
): Promise<ReportRow[]> {
  const where = eventSql(range, filters);
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string; views: number; clicks: number; visitors: number; sessions: number }>>`
    SELECT m.id, m.name,
      COUNT(DISTINCT e."visitorId")::int AS visitors,
      COUNT(DISTINCT e."sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE e.type = 'RETAILER_OFFER_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    JOIN "affiliate_links" l ON l.id = e."affiliateLinkId"
    JOIN "marketplaces" m ON m.id = l."marketplaceId"
    WHERE ${where}
      AND e."affiliateLinkId" IS NOT NULL
    GROUP BY m.id, m.name
    ORDER BY clicks DESC, views DESC
    LIMIT ${limit}
  `;

  return toReport(
    rows.map((row) => ({
      id: row.id,
      label: row.name,
      visitors: row.visitors,
      sessions: row.sessions,
      views: row.views,
      clicks: row.clicks,
      offerViews: row.views,
      ctr: ctr(Number(row.clicks), Number(row.views)),
    })),
  ).map((row) => ({
    ...row,
    ctr: ctr(row.clicks, row.views),
  }));
}

export async function getDeviceAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
): Promise<ReportRow[]> {
  const where = eventSql(range, filters);
  const rows = await prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
    SELECT CAST("deviceType" AS text) AS key,
      COUNT(DISTINCT "visitorId")::int AS visitors,
      COUNT(DISTINCT "sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    WHERE ${where}
    GROUP BY "deviceType"
    ORDER BY visitors DESC
  `;

  return toReport(
    rows.map((row) => ({
      id: row.key ?? "unknown",
      label: deviceLabel(row.key),
      visitors: row.visitors,
      sessions: row.sessions,
      views: row.views,
      clicks: row.clicks,
    })),
  );
}

export async function getSearchAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  limit = 50,
) {
  const where = eventSql(range, filters);

  const [kpis, popular, opportunities, resultClicks] = await Promise.all([
    prisma.$queryRaw<Array<{ searches: number; searchers: number; zero: number; resultClicks: number }>>`
      SELECT
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int AS searches,
        COUNT(DISTINCT "visitorId") FILTER (WHERE type = 'SEARCH')::int AS searchers,
        COUNT(*) FILTER (WHERE type = 'NO_SEARCH_RESULTS')::int AS zero,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int AS "resultClicks"
      FROM "analytics_events" e
      WHERE ${where}
    `,
    prisma.$queryRaw<Array<{ query: string; searches: number; searchers: number; clicks: number }>>`
      SELECT "searchQuery" AS query,
        COUNT(*) FILTER (WHERE type = 'SEARCH')::int AS searches,
        COUNT(DISTINCT "visitorId")::int AS searchers,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
        AND "searchQuery" IS NOT NULL
        AND type IN ('SEARCH', 'SEARCH_RESULT_CLICK', 'NO_SEARCH_RESULTS')
      GROUP BY "searchQuery"
      ORDER BY searches DESC, clicks DESC
      LIMIT ${limit}
    `,
    prisma.$queryRaw<Array<{ query: string; searches: number; searchers: number }>>`
      SELECT "searchQuery" AS query,
        COUNT(*)::int AS searches,
        COUNT(DISTINCT "visitorId")::int AS searchers
      FROM "analytics_events" e
      WHERE ${where}
        AND type = 'NO_SEARCH_RESULTS'
        AND "searchQuery" IS NOT NULL
      GROUP BY "searchQuery"
      ORDER BY searches DESC
      LIMIT ${limit}
    `,
    prisma.$queryRaw<Array<{ query: string; clicks: number; affiliateClicks: number }>>`
      SELECT "searchQuery" AS query,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int AS clicks,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS "affiliateClicks"
      FROM "analytics_events" e
      WHERE ${where}
        AND "searchQuery" IS NOT NULL
        AND type IN ('SEARCH_RESULT_CLICK', 'AFFILIATE_CLICK')
      GROUP BY "searchQuery"
      ORDER BY clicks DESC
      LIMIT ${limit}
    `,
  ]);

  const kpi = kpis[0] ?? { searches: 0, searchers: 0, zero: 0, resultClicks: 0 };

  return {
    searches: Number(kpi.searches),
    uniqueSearchers: Number(kpi.searchers),
    zeroResultSearches: Number(kpi.zero),
    searchResultClicks: Number(kpi.resultClicks),
    popular: toReport(
      popular.map((row) => ({
        id: row.query,
        label: row.query,
        visitors: row.searchers,
        sessions: 0,
        views: row.searches,
        clicks: row.clicks,
        searches: row.searches,
      })),
    ),
    opportunities: toReport(
      opportunities.map((row) => ({
        id: row.query,
        label: row.query,
        visitors: row.searchers,
        sessions: 0,
        views: row.searches,
        clicks: 0,
        searches: row.searches,
      })),
    ),
    resultClicks: resultClicks.map((row) => ({
      query: row.query,
      clicks: Number(row.clicks),
      affiliateClicks: Number(row.affiliateClicks),
    })),
  };
}

export async function getTimeSeriesAnalytics(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  productId?: string,
): Promise<Array<SeriesPoint & { visitors: number; sessions: number }>> {
  const where = eventSql(range, filters, productId);
  const rows = await prisma.$queryRaw<Array<{ day: Date; visitors: number; sessions: number; views: number; clicks: number }>>`
    SELECT date_trunc('day', "createdAt") AS day,
      COUNT(DISTINCT "visitorId")::int AS visitors,
      COUNT(DISTINCT "sessionId")::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    WHERE ${where}
    GROUP BY 1
    ORDER BY 1
  `;

  const map = new Map<string, { visitors: number; sessions: number; views: number; clicks: number }>();
  for (const row of rows) {
    const key = row.day instanceof Date ? formatIsoDate(row.day) : String(row.day).slice(0, 10);
    map.set(key, {
      visitors: Number(row.visitors),
      sessions: Number(row.sessions),
      views: Number(row.views),
      clicks: Number(row.clicks),
    });
  }

  return eachUtcDay(range.start, range.end).map((date) => ({
    date,
    visitors: map.get(date)?.visitors ?? 0,
    sessions: map.get(date)?.sessions ?? 0,
    views: map.get(date)?.views ?? 0,
    clicks: map.get(date)?.clicks ?? 0,
  }));
}

export async function getProductAnalytics(
  productId: string,
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
): Promise<ProductAnalytics> {
  const where = eventSql(range, filters, productId);

  const [kpis, countries, sources, campaigns, offers, searchQueries, series] = await Promise.all([
    prisma.$queryRaw<Array<{ views: number; visitors: number; sessions: number; clicks: number }>>`
      SELECT
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
        COUNT(DISTINCT "visitorId")::int AS visitors,
        COUNT(DISTINCT "sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
    `,
    prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
      SELECT "country" AS key,
        COUNT(DISTINCT "visitorId")::int AS visitors,
        COUNT(DISTINCT "sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
      GROUP BY "country"
      ORDER BY visitors DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
      SELECT COALESCE(NULLIF("sourceNormalized", ''), '(direct)') AS key,
        COUNT(DISTINCT "visitorId")::int AS visitors,
        COUNT(DISTINCT "sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
      GROUP BY 1
      ORDER BY visitors DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ key: string | null; visitors: number; sessions: number; views: number; clicks: number }>>`
      SELECT "utmCampaign" AS key,
        COUNT(DISTINCT "visitorId")::int AS visitors,
        COUNT(DISTINCT "sessionId")::int AS sessions,
        COUNT(*) FILTER (WHERE type = 'PRODUCT_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
        AND "utmCampaign" IS NOT NULL AND "utmCampaign" <> ''
      GROUP BY "utmCampaign"
      ORDER BY visitors DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; views: number; clicks: number }>>`
      SELECT l.id, m.name,
        COUNT(*) FILTER (WHERE e.type = 'RETAILER_OFFER_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "affiliate_links" l
      JOIN "marketplaces" m ON m.id = l."marketplaceId"
      LEFT JOIN "analytics_events" e
        ON e."affiliateLinkId" = l.id
        AND e."createdAt" >= ${range.start} AND e."createdAt" <= ${range.end}
      WHERE l."productId" = ${productId}
      GROUP BY l.id, m.name
      ORDER BY clicks DESC, views DESC
    `,
    prisma.$queryRaw<Array<{ query: string; views: number; clicks: number }>>`
      SELECT "searchQuery" AS query,
        COUNT(*) FILTER (WHERE type = 'SEARCH_RESULT_CLICK')::int AS views,
        COUNT(*) FILTER (WHERE type = 'AFFILIATE_CLICK')::int AS clicks
      FROM "analytics_events" e
      WHERE ${where}
        AND "searchQuery" IS NOT NULL
      GROUP BY "searchQuery"
      ORDER BY views DESC
      LIMIT 20
    `,
    getTimeSeriesAnalytics(range, filters, productId),
  ]);

  const kpi = kpis[0] ?? { views: 0, visitors: 0, sessions: 0, clicks: 0 };

  return {
    productId,
    views: Number(kpi.views),
    uniqueVisitors: Number(kpi.visitors),
    sessions: Number(kpi.sessions),
    affiliateClicks: Number(kpi.clicks),
    ctr: ctr(Number(kpi.clicks), Number(kpi.views)),
    countries: toReport(
      countries.map((row) => ({
        id: row.key?.trim() || "unknown",
        label: countryDisplayName(row.key),
        visitors: row.visitors,
        sessions: row.sessions,
        views: row.views,
        clicks: row.clicks,
      })),
    ),
    sources: toReport(
      sources.map((row) => ({
        id: row.key || "direct",
        label: row.key === "(direct)" ? "Direct" : (row.key ?? "Direct"),
        visitors: row.visitors,
        sessions: row.sessions,
        views: row.views,
        clicks: row.clicks,
      })),
    ),
    campaigns: toReport(
      campaigns.map((row) => ({
        id: row.key || "none",
        label: row.key || "(none)",
        visitors: row.visitors,
        sessions: row.sessions,
        views: row.views,
        clicks: row.clicks,
      })),
    ),
    offers: offers.map((row) => ({
      id: row.id,
      retailer: row.name,
      views: Number(row.views),
      clicks: Number(row.clicks),
      ctr: ctr(Number(row.clicks), Number(row.views)),
    })),
    searchQueries: toReport(
      searchQueries.map((row) => ({
        id: row.query,
        label: row.query,
        visitors: 0,
        sessions: 0,
        views: row.views,
        clicks: row.clicks,
      })),
    ),
    series,
  };
}

export function reportToRanked(rows: ReportRow[]): RankedRow[] {
  return rankedFromReport(rows);
}
