import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Page views, CTA/affiliate clicks, CTR, traffic sources and UTM attribution.
        </p>
      </div>
      <ComingSoon
        icon={BarChart3}
        title="Analytics dashboard"
        description="Event tracking, date-range filtering, top products/categories and traffic-source breakdowns, backed by the analytics event model from the approved architecture."
        phase="Phase 4 / 6 — Analytics event pipeline"
      />
    </div>
  );
}
