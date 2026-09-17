import type { Metadata } from "next";

import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getRetailerAnalytics } from "@/server/services/analytics-reports.service";

export const metadata: Metadata = { title: "Retailers" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsRetailersPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const rows = await getRetailerAnalytics(range, filters, 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Retailers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dynamically discovered from retailer offers. CTR is clicks ÷ offer views.
        </p>
      </div>
      <DateRangeFilter basePath="/admin/analytics/retailers" range={range} extraParams={filters} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Offer performance</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable
            rows={rows}
            emptyLabel="No retailer offer analytics in this range."
            nameLabel="Retailer"
            viewsLabel="Offer views"
          />
        </CardContent>
      </Card>
    </div>
  );
}
