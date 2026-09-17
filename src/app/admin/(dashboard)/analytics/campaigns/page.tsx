import type { Metadata } from "next";

import { AnalyticsExportButtons } from "@/components/admin/analytics-export-buttons";
import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsQueryString, parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getCampaignAnalytics } from "@/server/services/analytics-reports.service";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const rows = (await getCampaignAnalytics(range, filters, 100)).map((row) => ({
    ...row,
    href: `/admin/analytics${analyticsQueryString(range, { ...filters, campaign: row.label })}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last-touch UTM campaigns. First-touch source is stored on each event and is not overwritten.
        </p>
      </div>
      <DateRangeFilter basePath="/admin/analytics/campaigns" range={range} extraParams={filters} />
      <AnalyticsExportButtons range={range} filters={filters} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Campaign performance</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable rows={rows} emptyLabel="No campaigns in this range." nameLabel="Campaign" />
        </CardContent>
      </Card>
    </div>
  );
}
