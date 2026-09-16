import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getAdminSession } from "@/lib/auth";

/**
 * Admin shell: persistent sidebar on desktop, sheet-based nav on mobile
 * (see `AdminTopbar`), applied to every authenticated route under `/admin`
 * (everything except `/admin/login`, which lives outside this route group).
 *
 * `src/proxy.ts` already redirects unauthenticated requests before they
 * reach this layout, but we re-check here too — defense in depth, and it
 * lets us read the session to render the signed-in user in the topbar.
 */
export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 p-4 lg:block">
        <AdminSidebar />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminTopbar user={session} />
        <main className="min-w-0 flex-1 overflow-x-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
