"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { collectCampaignParams, track } from "@/lib/analytics";

interface TrafficBeaconProps {
  productId?: string;
  categoryId?: string;
}

/**
 * Single public-site beacon. Page classification (product / category /
 * search) happens server-side from the path so components do not each
 * emit their own events.
 */
export function TrafficBeacon({ productId, categoryId }: TrafficBeaconProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    track({
      path: pathname,
      search: searchParams.get("q"),
      referrer: document.referrer || null,
      productId,
      categoryId,
      ...collectCampaignParams(searchParams),
    });
  }, [pathname, productId, categoryId, searchParams]);

  return null;
}
