import type { Metadata } from "next";
import { DollarSign } from "lucide-react";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Revenue" };

export default function AdminRevenuePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manually entered commission data reconciled against click data.
        </p>
      </div>
      <ComingSoon
        icon={DollarSign}
        title="Revenue tracking"
        description="Manual entry of reported clicks/orders/commission per marketplace and period, since Amazon/eBay report commissions on their own dashboards with a delay."
        phase="Phase 6 — Revenue reconciliation"
      />
    </div>
  );
}
