import type { Metadata } from "next";

import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getDeviceAnalytics } from "@/server/services/analytics-reports.service";

export const metadata: Metadata = { title: "Devices" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsDevicesPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const rows = await getDeviceAnalytics(range, filters);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instagram traffic is typically mobile. CTR is clicks ÷ product views.
        </p>
      </div>
      <DateRangeFilter basePath="/admin/analytics/devices" range={range} extraParams={filters} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Device mix</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable rows={rows} emptyLabel="No device data in this range." nameLabel="Device" />
        </CardContent>
      </Card>
    </div>
  );
}
