import type { Metadata } from "next";

import { AnalyticsExportButtons } from "@/components/admin/analytics-export-buttons";
import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countryDetailHref, parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getCountryAnalytics } from "@/server/services/analytics-reports.service";

export const metadata: Metadata = { title: "Countries" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsCountriesPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const rows = (await getCountryAnalytics(range, filters, 100)).map((row) => ({
    ...row,
    href: countryDetailHref(row.id, range, filters),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Countries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approximate location from the visitor IP (or CDN headers when present). Click a country
          to see the products they viewed and the retailer clicks they made.
        </p>
      </div>
      <DateRangeFilter basePath="/admin/analytics/countries" range={range} extraParams={filters} />
      <AnalyticsExportButtons range={range} filters={filters} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Traffic by country</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable rows={rows} emptyLabel="No country data in this range." nameLabel="Country" />
        </CardContent>
      </Card>
    </div>
  );
}
