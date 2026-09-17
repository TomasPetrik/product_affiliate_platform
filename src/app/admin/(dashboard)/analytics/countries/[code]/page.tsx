import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, MousePointerClick, Percent, Users } from "lucide-react";

import { AnalyticsMetricTable } from "@/components/admin/analytics-metric-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { StatCard } from "@/components/admin/stat-card";
import { TimeSeriesChart } from "@/components/admin/time-series-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCtr } from "@/lib/analytics-attribution";
import { analyticsQueryString, parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { countryDisplayName, parseCountryPathParam } from "@/lib/geo";
import { getCountryDetailAnalytics } from "@/server/services/analytics-reports.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<DateRangeSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `${countryDisplayName(parseCountryPathParam(code))} · Countries` };
}

export default async function AdminAnalyticsCountryDetailPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const country = parseCountryPathParam(code);
  if (!country) notFound();

  const query = await searchParams;
  const range = resolveDateRange(query);
  const filters = parseAnalyticsFilters(query);
  const analytics = await getCountryDetailAnalytics(country, range, { ...filters, country: null });
  const basePath = `/admin/analytics/countries/${country === "unknown" ? "unknown" : country}`;
  const productQuery = analyticsQueryString(range, {
    ...filters,
    country: country === "unknown" ? "unknown" : country,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Country analytics</p>
          <h1 className="text-2xl font-bold tracking-tight">{analytics.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Product views and affiliate clicks from this location. City is approximate and omitted
            when the IP lookup cannot resolve it.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href={`/admin/analytics/countries${analyticsQueryString(range, { ...filters, country: null })}`} />}>
          All countries
        </Button>
      </div>

      <DateRangeFilter basePath={basePath} range={range} extraParams={{ ...filters, country: null }} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitors" value={analytics.visitors.toLocaleString()} icon={Users} />
        <StatCard label="Product views" value={analytics.views.toLocaleString()} icon={Eye} />
        <StatCard label="Affiliate clicks" value={analytics.clicks.toLocaleString()} icon={MousePointerClick} />
        <StatCard label="CTR" value={formatCtr(analytics.ctr)} icon={Percent} hint="Clicks ÷ product views" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Views over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={analytics.series} dataKey="views" label="Views" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Affiliate clicks over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={analytics.series} dataKey="clicks" color="var(--chart-3)" label="Clicks" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Products viewed and clicked</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable
            rows={analytics.products.map((row) => ({
              ...row,
              href: `/admin/products/${row.id}/analytics${productQuery}`,
            }))}
            emptyLabel="No product views or clicks from this country in this range."
            nameLabel="Product"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cities</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable rows={analytics.cities} emptyLabel="No city data for this country." nameLabel="City" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent affiliate clicks</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Retailer</TableHead>
                  <TableHead>City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.recentClicks.map((click) => (
                  <TableRow key={click.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {click.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`${click.productHref}${productQuery}`} className="underline-offset-2 hover:underline">
                        {click.productTitle}
                      </Link>
                    </TableCell>
                    <TableCell>{click.retailer}</TableCell>
                    <TableCell>{click.city}</TableCell>
                  </TableRow>
                ))}
                {analytics.recentClicks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No affiliate clicks from this country in this range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
