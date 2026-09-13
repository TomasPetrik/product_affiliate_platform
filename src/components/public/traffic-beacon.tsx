"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface TrafficBeaconProps {
  productId?: string;
}

export function TrafficBeacon({ productId }: TrafficBeaconProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const payload = {
      path: pathname,
      referrer: document.referrer || null,
      productId,
      source: searchParams.get("utm_source"),
      medium: searchParams.get("utm_medium"),
      campaign: searchParams.get("utm_campaign"),
      term: searchParams.get("utm_term"),
      content: searchParams.get("utm_content"),
    };

    void fetch("/api/t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Tracking must never break the page.
    });
  }, [pathname, productId, searchParams]);

  return null;
}
