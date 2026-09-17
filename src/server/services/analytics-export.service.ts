import { formatCtr } from "@/lib/analytics-attribution";
import { toCsv, type AnalyticsExportType } from "@/lib/analytics-csv";
import type { AnalyticsQueryFilters } from "@/lib/analytics-query";
import type { ResolvedDateRange } from "@/lib/date-range";
import { prisma } from "@/lib/prisma";
import { getCampaignAnalytics, getCountryAnalytics } from "@/server/services/analytics-reports.service";

export { ANALYTICS_EXPORT_TYPES, canReadAnalytics, isAnalyticsExportType, toCsv } from "@/lib/analytics-csv";
export type { AnalyticsExportType } from "@/lib/analytics-csv";

export async function exportAnalyticsCsv(
  type: AnalyticsExportType,
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
): Promise<{ filename: string; csv: string }> {
  const stamp = range.fromParam;

  if (type === "countries") {
    const rows = await getCountryAnalytics(range, filters, 500);
    return {
      filename: `analytics-countries-${stamp}.csv`,
      csv: toCsv(
        ["country", "visitors", "sessions", "product_views", "affiliate_clicks", "ctr"],
        rows.map((row) => [row.label, row.visitors, row.sessions, row.views, row.clicks, formatCtr(row.ctr)]),
      ),
    };
  }

  if (type === "campaigns") {
    const rows = await getCampaignAnalytics(range, filters, 500);
    return {
      filename: `analytics-campaigns-${stamp}.csv`,
      csv: toCsv(
        ["campaign", "visitors", "sessions", "product_views", "affiliate_clicks", "ctr"],
        rows.map((row) => [row.label, row.visitors, row.sessions, row.views, row.clicks, formatCtr(row.ctr)]),
      ),
    };
  }

  if (type === "clicks") {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        type: "AFFILIATE_CLICK",
        createdAt: { gte: range.start, lte: range.end },
        country: filters.country === "unknown" ? null : filters.country ?? undefined,
        sourceNormalized: filters.source ?? undefined,
        utmMedium: filters.medium ?? undefined,
        utmCampaign: filters.campaign ?? undefined,
      },
      select: {
        createdAt: true,
        country: true,
        city: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        firstUtmSource: true,
        firstUtmCampaign: true,
        product: { select: { title: true, slug: true } },
        affiliateLink: { select: { marketplace: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5_000,
    });

    return {
      filename: `analytics-affiliate-clicks-${stamp}.csv`,
      csv: toCsv(
        [
          "timestamp",
          "product",
          "retailer",
          "country",
          "city",
          "last_source",
          "last_medium",
          "last_campaign",
          "first_source",
          "first_campaign",
        ],
        events.map((event) => [
          event.createdAt.toISOString(),
          event.product?.title ?? "",
          event.affiliateLink?.marketplace.name ?? "",
          event.country,
          event.city,
          event.utmSource,
          event.utmMedium,
          event.utmCampaign,
          event.firstUtmSource,
          event.firstUtmCampaign,
        ]),
      ),
    };
  }

  const grouped = await prisma.$queryRaw<Array<{ id: string; title: string; views: number; clicks: number }>>`
    SELECT p.id, p.title,
      COUNT(*) FILTER (WHERE e.type = 'PRODUCT_VIEW')::int AS views,
      COUNT(*) FILTER (WHERE e.type = 'AFFILIATE_CLICK')::int AS clicks
    FROM "analytics_events" e
    JOIN "products" p ON p.id = e."productId"
    WHERE e."createdAt" >= ${range.start} AND e."createdAt" <= ${range.end}
    GROUP BY p.id, p.title
    ORDER BY views DESC
    LIMIT 500
  `;

  return {
    filename: `analytics-products-${stamp}.csv`,
    csv: toCsv(
      ["product", "views", "affiliate_clicks", "ctr"],
      grouped.map((row) => [
        row.title,
        Number(row.views),
        Number(row.clicks),
        formatCtr(Number(row.views) > 0 ? (Number(row.clicks) / Number(row.views)) * 100 : null),
      ]),
    ),
  };
}
