import type { Metadata } from "next";

import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsQueryString, parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getSourceAnalytics } from "@/server/services/analytics-reports.service";

export const metadata: Metadata = { title: "Sources" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsSourcesPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const rows = (await getSourceAnalytics(range, filters, 100)).map((row) => ({
    ...row,
    href: `/admin/analytics${analyticsQueryString(range, { ...filters, source: row.label })}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Traffic sources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last-touch source from UTM parameters or the HTTP referrer, normalized to Instagram,
          Google, Facebook, Direct, or Other.
        </p>
      </div>
      <DateRangeFilter basePath="/admin/analytics/sources" range={range} extraParams={filters} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sources</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable rows={rows} emptyLabel="No source data in this range." nameLabel="Source" />
        </CardContent>
      </Card>
    </div>
  );
}
