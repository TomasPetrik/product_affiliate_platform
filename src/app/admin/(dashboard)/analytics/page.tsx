import type { Metadata } from "next";

import { AnalyticsOverview } from "@/components/admin/analytics-overview";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getDashboardAnalytics } from "@/server/services/analytics.service";

export const metadata: Metadata = { title: "Analytics" };

export const dynamic = "force-dynamic";

interface AdminAnalyticsPageProps {
  searchParams: Promise<DateRangeSearchParams>;
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  const range = resolveDateRange(await searchParams);
  const analytics = await getDashboardAnalytics(range);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Product views, unique visitors, affiliate clicks, CTR, and campaign sources from the live
          event tables.
        </p>
      </div>
      <AnalyticsOverview data={analytics} basePath="/admin/analytics" />
    </div>
  );
}
