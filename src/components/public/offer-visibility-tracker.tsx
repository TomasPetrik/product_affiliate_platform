"use client";

import { useEffect, useRef } from "react";

import { track } from "@/lib/analytics";

interface OfferVisibilityTrackerProps {
  offerId: string;
  productId: string;
}

/**
 * Records `retailer_offer_view` only when the offer is actually visible.
 */
export function OfferVisibilityTracker({ offerId, productId }: OfferVisibilityTrackerProps) {
  const sent = useRef(false);

  useEffect(() => {
    const node = document.getElementById(`offer-${offerId}`);
    if (!node || sent.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (sent.current) return;
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
        sent.current = true;
        track({
          events: ["retailer_offer_view"],
          affiliateLinkId: offerId,
          productId,
        });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [offerId, productId]);

  return null;
}
