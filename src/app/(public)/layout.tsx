import type { ReactNode } from "react";
import { Suspense } from "react";

import { DisclosureBanner } from "@/components/public/disclosure-banner";
import { PrivacyConsent } from "@/components/public/privacy-consent";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { TrafficBeacon } from "@/components/public/traffic-beacon";
import { readRequestConsent } from "@/server/consent";

async function ConsentAndBeacon() {
  const snapshot = await readRequestConsent();

  return (
    <>
      <TrafficBeacon region={snapshot.region} initialConsent={snapshot.consent} gpc={snapshot.gpc} />
      <PrivacyConsent region={snapshot.region} initialConsent={snapshot.consent} gpc={snapshot.gpc} />
    </>
  );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Suspense fallback={null}>
        <ConsentAndBeacon />
      </Suspense>
      <DisclosureBanner className="min-w-0" />
      <SiteHeader />
      <main id="main-content" className="min-w-0 flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
