import type { DateRangeSearchParams, ResolvedDateRange } from "@/lib/date-range";
import { parseCountryPathParam } from "@/lib/geo";

export interface AnalyticsQueryFilters {
  country?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  [key: string]: string | null | undefined;
}

const SOURCE_VALUES = new Set(["Instagram", "Google", "Facebook", "Direct", "Other"]);

export function parseAnalyticsFilters(params: DateRangeSearchParams): AnalyticsQueryFilters {
  const country = parseCountryPathParam(params.country);
  const source = params.source?.trim();
  const medium = params.medium?.trim().slice(0, 200) || null;
  const campaign = params.campaign?.trim().slice(0, 200) || null;

  return {
    country,
    source: source && SOURCE_VALUES.has(source) ? source : source ? source.slice(0, 80) : null,
    medium,
    campaign,
  };
}

export function analyticsQueryString(
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
  extra: Record<string, string | null | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set("range", range.preset);
  if (range.preset === "custom") {
    params.set("from", range.fromParam);
    params.set("to", range.toParam);
  }
  if (filters.country) params.set("country", filters.country);
  if (filters.source) params.set("source", filters.source);
  if (filters.medium) params.set("medium", filters.medium);
  if (filters.campaign) params.set("campaign", filters.campaign);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasAnalyticsFilters(filters: AnalyticsQueryFilters): boolean {
  return Boolean(filters.country || filters.source || filters.medium || filters.campaign);
}

export function countryDetailHref(
  code: string,
  range: ResolvedDateRange,
  filters: AnalyticsQueryFilters = {},
): string {
  const slug = code === "unknown" ? "unknown" : code.toUpperCase();
  return `/admin/analytics/countries/${slug}${analyticsQueryString(range, { ...filters, country: null })}`;
}
