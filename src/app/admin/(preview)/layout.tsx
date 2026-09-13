import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DisclosureBanner } from "@/components/public/disclosure-banner";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Public-site chrome for admin product previews, without the dashboard
 * sidebar and without the public traffic beacon (previews must not count
 * as views). Auth is still enforced by `src/proxy.ts`.
 */
export default function AdminPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <DisclosureBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
