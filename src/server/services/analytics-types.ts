import type { ResolvedDateRange } from "@/lib/date-range";

export interface AnalyticsKpis {
  pageViews: number;
  productViews: number;
  categoryViews: number;
  searches: number;
  uniqueVisitors: number;
  sessions: number;
  affiliateClicks: number;
  outboundClicks: number;
  affiliateCtr: number | null;
}

export interface RankedRow {
  id: string;
  label: string;
  href?: string;
  views: number;
  clicks: number;
  visitors?: number;
  sessions?: number;
  ctr?: number | null;
  /** Latest synced lifetime marketing-video views (all platforms). */
  marketingViews?: number;
  /** Per-platform lifetime views for marketing posts linked to this product. */
  platformViews?: {
    INSTAGRAM: number;
    FACEBOOK: number;
    YOUTUBE: number;
    TIKTOK: number;
  };
}

export interface SeriesPoint {
  date: string;
  views: number;
  clicks: number;
  visitors?: number;
  sessions?: number;
}

export interface DashboardAnalytics {
  range: ResolvedDateRange;
  kpis: AnalyticsKpis;
  topProducts: RankedRow[];
  topCategories: RankedRow[];
  topSources: RankedRow[];
  topCampaigns: RankedRow[];
  topSearches: RankedRow[];
  topCountries: RankedRow[];
  topRetailers: RankedRow[];
  opportunities: RankedRow[];
  devices: RankedRow[];
  series: SeriesPoint[];
  hasData: boolean;
}
