import { BarChart3, ExternalLink, Eye, Layers, MousePointerClick, Percent, Search, Users } from "lucide-react";

import { AnalyticsExportButtons } from "@/components/admin/analytics-export-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { EmptyState } from "@/components/admin/empty-state";
import { RankedTable } from "@/components/admin/ranked-table";
import { StatCard } from "@/components/admin/stat-card";
import { TimeSeriesChart } from "@/components/admin/time-series-chart";
import { dateRangeLabel } from "@/lib/date-range";
import type { DashboardAnalytics } from "@/server/services/analytics.service";

function formatCtr(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

interface AnalyticsOverviewProps {
  data: DashboardAnalytics;
  basePath: string;
}

export function AnalyticsOverview({ data, basePath }: AnalyticsOverviewProps) {
  const { kpis, range } = data;

  return (
    <div className="flex flex-col gap-6">
      <DateRangeFilter basePath={basePath} range={range} />
      {basePath.startsWith("/admin/analytics") ? <AnalyticsExportButtons range={range} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Page views"
          value={kpis.pageViews.toLocaleString()}
          icon={Eye}
          hint={dateRangeLabel(range)}
        />
        <StatCard
          label="Product views"
          value={kpis.productViews.toLocaleString()}
          icon={Eye}
          hint="Deduped PDP impressions"
        />
        <StatCard
          label="Affiliate clicks"
          value={kpis.affiliateClicks.toLocaleString()}
          icon={MousePointerClick}
          hint="Outbound marketplace clicks"
        />
        <StatCard
          label="Affiliate CTR"
          value={formatCtr(kpis.affiliateCtr)}
          icon={Percent}
          hint={kpis.affiliateCtr === null ? "Needs at least one view" : "Clicks ÷ product views"}
        />
        <StatCard
          label="Unique visitors"
          value={kpis.uniqueVisitors.toLocaleString()}
          icon={Users}
          hint="Anonymous visitor IDs"
        />
        <StatCard
          label="Sessions"
          value={kpis.sessions.toLocaleString()}
          icon={Users}
          hint="Idle timeout 30 minutes"
        />
        <StatCard
          label="Category views"
          value={kpis.categoryViews.toLocaleString()}
          icon={Layers}
          hint="Category landing pages"
        />
        <StatCard
          label="Searches"
          value={kpis.searches.toLocaleString()}
          icon={Search}
          hint="Product search submissions"
        />
        <StatCard
          label="Outbound clicks"
          value={kpis.outboundClicks.toLocaleString()}
          icon={ExternalLink}
          hint="Non-affiliate external hops"
        />
      </div>

      {!data.hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No traffic in this range"
          description="Page views, product views, searches, and campaign data will appear here once visitors use the public site."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Views over time</CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.pageViews === 0 && kpis.productViews === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No views yet.</p>
                ) : (
                  <TimeSeriesChart data={data.series} dataKey="views" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Clicks over time</CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.affiliateClicks === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No affiliate clicks yet.</p>
                ) : (
                  <TimeSeriesChart data={data.series} dataKey="clicks" color="var(--chart-3)" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top products</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.topProducts} emptyLabel="No product views in this range." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top categories</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.topCategories} emptyLabel="No category views in this range." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top traffic sources</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.topSources} emptyLabel="No traffic sources in this range." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top UTM campaigns</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.topCampaigns} emptyLabel="No UTM campaigns in this range." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top searches</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable
                  rows={data.topSearches}
                  emptyLabel="No searches in this range."
                  showClicks={false}
                  metricLabel="Searches"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top countries</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.topCountries} emptyLabel="No country data in this range." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top retailers</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.topRetailers} emptyLabel="No retailer clicks in this range." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Product opportunities</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable
                  rows={data.opportunities}
                  emptyLabel="No zero-result searches in this range."
                  showClicks={false}
                  metricLabel="Searches"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Devices</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable rows={data.devices} emptyLabel="No device data in this range." />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
