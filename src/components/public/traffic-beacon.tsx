"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { collectCampaignParams, track } from "@/lib/analytics";
import {
  allowsAnalytics,
  clientHasGpc,
  CONSENT_CHANGE_EVENT,
  type ConsentRegion,
  type ConsentState,
} from "@/lib/consent";

interface TrafficBeaconProps {
  productId?: string;
  categoryId?: string;
  region: ConsentRegion;
  initialConsent: ConsentState | null;
  gpc: boolean;
}

/**
 * Single public-site beacon. Page classification (product / category /
 * search) happens server-side from the path so components do not each
 * emit their own events. Analytics cookies are only sent after consent
 * rules for the visitor's region allow them.
 */
export function TrafficBeacon({
  productId,
  categoryId,
  region,
  initialConsent,
  gpc,
}: TrafficBeaconProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState(initialConsent);

  useEffect(() => {
    function onConsent(event: Event) {
      const detail = (event as CustomEvent<ConsentState>).detail;
      if (detail) setConsent(detail);
    }

    window.addEventListener(CONSENT_CHANGE_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (!allowsAnalytics(consent, region, gpc || clientHasGpc())) return;

    track({
      path: pathname,
      search: searchParams.get("q"),
      referrer: document.referrer || null,
      productId,
      categoryId,
      ...collectCampaignParams(searchParams),
    });
  }, [pathname, productId, categoryId, searchParams, consent, region, gpc]);

  return null;
}
