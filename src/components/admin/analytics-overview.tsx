import { BarChart3, Eye, MousePointerClick, Percent, Users } from "lucide-react";

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Product views"
          value={kpis.productViews.toLocaleString()}
          icon={Eye}
          hint={dateRangeLabel(range)}
        />
        <StatCard
          label="Unique visitors"
          value={kpis.uniqueVisitors.toLocaleString()}
          icon={Users}
          hint="Distinct anonymous sessions"
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
          hint={kpis.affiliateCtr === null ? "Needs at least one view" : "Clicks ÷ views"}
        />
      </div>

      {!data.hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No traffic in this range"
          description="Views, clicks, and campaign data will appear here once visitors land on product pages or follow affiliate links."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Views over time</CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.productViews === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No product views yet.</p>
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
                <RankedTable
                  rows={data.topSources}
                  emptyLabel="No UTM sources in this range."
                  showClicks={false}
                  metricLabel="Events"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top UTM campaigns</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <RankedTable
                  rows={data.topCampaigns}
                  emptyLabel="No UTM campaigns in this range."
                  showClicks={false}
                  metricLabel="Events"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
