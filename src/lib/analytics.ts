export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "product_view",
  "category_view",
  "search",
  "affiliate_click",
  "outbound_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export interface AnalyticsEventPayload {
  type?: AnalyticsEventName;
  events?: AnalyticsEventName[];
  path?: string;
  search?: string | null;
  referrer?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  destinationUrl?: string | null;
  affiliateLinkId?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

const ENDPOINT = "/api/t";

/**
 * First-party client tracker. Components should call this instead of
 * posting to `/api/t` themselves so payloads stay consistent.
 */
export function track(payload: AnalyticsEventPayload): void {
  if (typeof window === "undefined") return;

  const body: AnalyticsEventPayload = {
    ...payload,
    events: payload.events ?? (payload.type ? [payload.type] : undefined),
    path: payload.path ?? window.location.pathname,
    search: payload.search ?? new URLSearchParams(window.location.search).get("q"),
    referrer: payload.referrer ?? (document.referrer || null),
  };

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // Tracking must never break the page.
    });
  } catch {
    // Tracking must never break the page.
  }
}

export function outboundHref(url: string): string {
  return `/go?u=${encodeURIComponent(url)}`;
}

export function collectCampaignParams(searchParams: Pick<URLSearchParams, "get">): Pick<
  AnalyticsEventPayload,
  "source" | "medium" | "campaign" | "term" | "content"
> {
  return {
    source: searchParams.get("utm_source"),
    medium: searchParams.get("utm_medium"),
    campaign: searchParams.get("utm_campaign"),
    term: searchParams.get("utm_term"),
    content: searchParams.get("utm_content"),
  };
}
