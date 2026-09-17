import { z } from "zod";

export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "product_view",
  "category_view",
  "search",
  "search_result_click",
  "no_search_results",
  "retailer_offer_view",
  "affiliate_click",
  "outbound_click",
  "share",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const INSTAGRAM_METADATA_KEYS = [
  "instagram_post_id",
  "instagram_campaign_id",
  "instagram_comment",
  "instagram_dm_sent",
  "instagram_dm_click",
] as const;

export type InstagramMetadataKey = (typeof INSTAGRAM_METADATA_KEYS)[number];

export interface AnalyticsEventPayload {
  type?: AnalyticsEventName;
  events?: AnalyticsEventName[];
  path?: string;
  search?: string | null;
  resultCount?: number | null;
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
  metadata?: Record<string, string | number | boolean | null> | null;
}

export const analyticsEventPayloadSchema = z.object({
  path: z.string().max(500).optional(),
  search: z.string().max(200).optional().nullable(),
  resultCount: z.number().int().min(0).max(10_000).optional().nullable(),
  referrer: z.string().max(1000).optional().nullable(),
  productId: z.string().max(64).optional().nullable(),
  categoryId: z.string().max(64).optional().nullable(),
  destinationUrl: z.string().max(2000).optional().nullable(),
  affiliateLinkId: z.string().max(64).optional().nullable(),
  events: z.array(z.enum(ANALYTICS_EVENT_NAMES)).max(8).optional(),
  source: z.string().max(200).optional().nullable(),
  medium: z.string().max(200).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  term: z.string().max(200).optional().nullable(),
  content: z.string().max(200).optional().nullable(),
  metadata: z
    .record(z.string().max(64), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
    .optional()
    .nullable(),
});

export type ParsedAnalyticsPayload = z.infer<typeof analyticsEventPayloadSchema>;

export function isBlockedAnalyticsPath(path: string | null | undefined): boolean {
  const value = path ?? "";
  return value.startsWith("/admin") || value.startsWith("/api") || value.startsWith("/out") || value.startsWith("/go");
}

export function sanitizeAnalyticsMetadata(
  input: Record<string, string | number | boolean | null> | null | undefined,
): Record<string, string | number | boolean | null> | null {
  if (!input) return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!/^[a-z0-9_]{1,64}$/.test(key)) continue;
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
      continue;
    }
    const trimmed = String(value).trim();
    if (trimmed) out[key] = trimmed.slice(0, 200);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function searchEventsForResultCount(resultCount: number | null | undefined): AnalyticsEventName[] {
  if (resultCount == null) return ["search"];
  if (resultCount <= 0) return ["search", "no_search_results"];
  return ["search"];
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

export function collectInstagramMetadata(searchParams: Pick<URLSearchParams, "get">): Record<string, string> | null {
  const metadata: Record<string, string> = {};
  for (const key of INSTAGRAM_METADATA_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) metadata[key] = value.slice(0, 200);
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}
