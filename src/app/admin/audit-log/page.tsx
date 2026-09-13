import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAuditLogPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who changed what, and when — read-only trail of every admin mutation.
        </p>
      </div>
      <ComingSoon
        icon={ClipboardList}
        title="Audit trail"
        description="Every publish/unpublish, link edit and revenue entry will be recorded with actor, before/after state and timestamp once admin auth and CRUD actions land."
        phase="Phase 2 — Admin CRUD"
      />
    </div>
  );
}
