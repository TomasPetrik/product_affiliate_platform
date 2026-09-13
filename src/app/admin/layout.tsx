import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

/**
 * Admin shell: persistent sidebar on desktop, sheet-based nav on mobile
 * (see `AdminTopbar`), applied to every route under `/admin`.
 *
 * NOTE: this layout does not yet enforce authentication/authorization —
 * that lands with admin auth in the next phase (see project README /
 * "remaining work"). Do not deploy this route publicly until that guard is
 * in place.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 p-4 lg:block">
        <AdminSidebar />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
