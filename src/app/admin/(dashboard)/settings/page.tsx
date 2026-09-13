import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Site-wide SEO defaults, marketplace connections and admin user management.
        </p>
      </div>
      <ComingSoon
        icon={Settings}
        title="Site settings"
        description="Default SEO metadata, marketplace API connection status and admin user/role management."
        phase="Phase 2 — Admin auth & CRUD"
      />
    </div>
  );
}
