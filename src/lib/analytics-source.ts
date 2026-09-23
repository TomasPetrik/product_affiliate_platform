export const KNOWN_TRAFFIC_SOURCES = [
  "Instagram",
  "Google",
  "Facebook",
  "YouTube",
  "TikTok",
  "Direct",
  "Other",
] as const;

export type KnownTrafficSource = (typeof KNOWN_TRAFFIC_SOURCES)[number];

const SOURCE_ALIASES: Record<string, KnownTrafficSource> = {
  instagram: "Instagram",
  ig: "Instagram",
  google: "Google",
  googleads: "Google",
  "google-ads": "Google",
  facebook: "Facebook",
  fb: "Facebook",
  meta: "Facebook",
  youtube: "YouTube",
  yt: "YouTube",
  "youtube-shorts": "YouTube",
  youtu: "YouTube",
  tiktok: "TikTok",
  tt: "TikTok",
  "tik-tok": "TikTok",
  direct: "Direct",
  "(direct)": "Direct",
  none: "Direct",
};

const HOST_ALIASES: Array<{ match: RegExp; source: KnownTrafficSource }> = [
  { match: /(^|\.)instagram\.com$/i, source: "Instagram" },
  { match: /(^|\.)cdninstagram\.com$/i, source: "Instagram" },
  { match: /(^|\.)ig\.me$/i, source: "Instagram" },
  { match: /(^|\.)google\./i, source: "Google" },
  { match: /(^|\.)googleusercontent\.com$/i, source: "Google" },
  { match: /(^|\.)facebook\.com$/i, source: "Facebook" },
  { match: /(^|\.)fb\.com$/i, source: "Facebook" },
  { match: /(^|\.)fbcdn\.net$/i, source: "Facebook" },
  { match: /(^|\.)l\.facebook\.com$/i, source: "Facebook" },
  { match: /(^|\.)youtube\.com$/i, source: "YouTube" },
  { match: /(^|\.)youtu\.be$/i, source: "YouTube" },
  { match: /(^|\.)tiktok\.com$/i, source: "TikTok" },
  { match: /(^|\.)tiktokv\.com$/i, source: "TikTok" },
];

function hostFromReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeUtmSource(raw: string | null | undefined): KnownTrafficSource | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  return SOURCE_ALIASES[value] ?? null;
}

/**
 * Last-touch display source. UTM wins over the HTTP referrer.
 * Does not identify a person — only a channel bucket.
 */
export function normalizeTrafficSource(
  utmSource: string | null | undefined,
  referrer: string | null | undefined,
): KnownTrafficSource {
  const fromUtm = normalizeUtmSource(utmSource);
  if (fromUtm) return fromUtm;

  const host = hostFromReferrer(referrer);
  if (host) {
    for (const rule of HOST_ALIASES) {
      if (rule.match.test(host)) return rule.source;
    }
    return "Other";
  }

  if (utmSource?.trim()) return "Other";
  return "Direct";
}
