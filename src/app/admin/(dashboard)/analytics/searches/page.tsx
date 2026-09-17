import type { Metadata } from "next";

import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getSearchAnalytics } from "@/server/services/analytics-reports.service";
import { Search, Users, MousePointerClick, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Searches" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsSearchesPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const data = await getSearchAnalytics(range, filters, 50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zero-result queries are product opportunities for the catalog.
        </p>
      </div>
      <DateRangeFilter basePath="/admin/analytics/searches" range={range} extraParams={filters} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Searches" value={data.searches.toLocaleString()} icon={Search} />
        <StatCard label="Unique searchers" value={data.uniqueSearchers.toLocaleString()} icon={Users} />
        <StatCard label="Zero-result searches" value={data.zeroResultSearches.toLocaleString()} icon={AlertTriangle} />
        <StatCard label="Result clicks" value={data.searchResultClicks.toLocaleString()} icon={MousePointerClick} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Popular searches</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable
              rows={data.popular}
              emptyLabel="No searches in this range."
              nameLabel="Query"
              viewsLabel="Searches"
              showSessions={false}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Product opportunities</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable
              rows={data.opportunities}
              emptyLabel="No zero-result searches in this range."
              nameLabel="Query"
              viewsLabel="Searches"
              showSessions={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
