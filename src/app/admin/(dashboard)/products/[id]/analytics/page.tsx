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
import { formatCtr } from "@/lib/analytics-attribution";
import { countryDetailHref, parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getProductAnalytics } from "@/server/services/analytics-reports.service";
import { getProductByIdAdmin } from "@/server/services/product.service";

export const metadata: Metadata = { title: "Product analytics" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<DateRangeSearchParams>;
}

export default async function AdminProductAnalyticsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const product = await getProductByIdAdmin(id);
  if (!product) notFound();

  const query = await searchParams;
  const range = resolveDateRange(query);
  const filters = parseAnalyticsFilters(query);
  const analytics = await getProductAnalytics(product.id, range, filters);
  const basePath = `/admin/products/${product.id}/analytics`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Product analytics</p>
          <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/{product.slug}</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href={`/admin/products/${product.id}`} />}>
          Back to product
        </Button>
      </div>

      <DateRangeFilter basePath={basePath} range={range} extraParams={filters} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Views" value={analytics.views.toLocaleString()} icon={Eye} />
        <StatCard label="Unique visitors" value={analytics.uniqueVisitors.toLocaleString()} icon={Users} />
        <StatCard label="Affiliate clicks" value={analytics.affiliateClicks.toLocaleString()} icon={MousePointerClick} />
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Countries</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable
              rows={analytics.countries.map((row) => ({
                ...row,
                href: countryDetailHref(row.id, range, filters),
              }))}
              emptyLabel="No country data."
              nameLabel="Country"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Traffic sources</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable rows={analytics.sources} emptyLabel="No source data." nameLabel="Source" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable rows={analytics.campaigns} emptyLabel="No campaigns." nameLabel="Campaign" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Search queries</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <AnalyticsMetricTable
              rows={analytics.searchQueries}
              emptyLabel="No search-driven visits."
              nameLabel="Query"
              viewsLabel="Result clicks"
              showSessions={false}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Retailer offers</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <AnalyticsMetricTable
            rows={analytics.offers.map((offer) => ({
              id: offer.id,
              label: offer.retailer,
              visitors: 0,
              sessions: 0,
              views: offer.views,
              clicks: offer.clicks,
              offerViews: offer.views,
              ctr: offer.ctr,
            }))}
            emptyLabel="No retailer offers."
            nameLabel="Retailer"
            viewsLabel="Offer views"
            showSessions={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
