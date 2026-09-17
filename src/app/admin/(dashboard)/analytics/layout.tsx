import type { ReactNode } from "react";

import { AnalyticsNav } from "@/components/admin/analytics-nav";

export default function AdminAnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <AnalyticsNav />
      {children}
    </div>
  );
}
