import type { Metadata } from "next";
import { UploadCloud } from "lucide-react";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Imports" };

export default function AdminImportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Imports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import products from Amazon and eBay by keyword or ASIN/item ID.
        </p>
      </div>
      <ComingSoon
        icon={UploadCloud}
        title="Marketplace import"
        description="Search-and-import from the Amazon Product Advertising API and eBay Browse API, with manual ASIN/URL entry as a fallback, job history and per-item status."
        phase="Phase 5 — Marketplace integration"
      />
    </div>
  );
}
