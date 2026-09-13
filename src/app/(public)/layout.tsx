import type { ReactNode } from "react";
import { Suspense } from "react";

import { DisclosureBanner } from "@/components/public/disclosure-banner";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { TrafficBeacon } from "@/components/public/traffic-beacon";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <TrafficBeacon />
      </Suspense>
      <DisclosureBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
