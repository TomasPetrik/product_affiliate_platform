import type { Metadata } from "next";

import { AnalyticsOverview } from "@/components/admin/analytics-overview";
import { parseAnalyticsFilters } from "@/lib/analytics-query";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getDashboardAnalytics } from "@/server/services/analytics.service";

export const metadata: Metadata = { title: "Analytics" };

export const dynamic = "force-dynamic";

interface AdminAnalyticsPageProps {
  searchParams: Promise<DateRangeSearchParams>;
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const filters = parseAnalyticsFilters(params);
  const analytics = await getDashboardAnalytics(range, filters);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          First-party product, retailer, search, country, and campaign analytics. Complements GA4;
          it does not replace it.
        </p>
      </div>
      <AnalyticsOverview data={analytics} basePath="/admin/analytics" />
    </div>
  );
}
