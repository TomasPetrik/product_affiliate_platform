/** 9:16 merge export size presets. */

export const MERGE_EXPORT_QUALITIES = ["720p", "1080p", "2K"] as const;

export type MergeExportQuality = (typeof MERGE_EXPORT_QUALITIES)[number];

export const DEFAULT_MERGE_EXPORT_QUALITY: MergeExportQuality = "1080p";

export const MERGE_EXPORT_QUALITY_SIZES: Record<
  MergeExportQuality,
  { width: number; height: number; label: string }
> = {
  "720p": { width: 720, height: 1280, label: "720p · 720×1280" },
  "1080p": { width: 1080, height: 1920, label: "1080p · 1080×1920" },
  "2K": { width: 1440, height: 2560, label: "2K · 1440×2560" },
};

export function isMergeExportQuality(value: unknown): value is MergeExportQuality {
  return (
    typeof value === "string" &&
    (MERGE_EXPORT_QUALITIES as readonly string[]).includes(value)
  );
}

export function parseMergeExportQuality(
  value: unknown,
): MergeExportQuality {
  return isMergeExportQuality(value) ? value : DEFAULT_MERGE_EXPORT_QUALITY;
}

export function mergeExportSize(quality: MergeExportQuality): {
  width: number;
  height: number;
} {
  const size = MERGE_EXPORT_QUALITY_SIZES[quality];
  return { width: size.width, height: size.height };
}

/**
 * Classify a clip's native resolution into a short quality label.
 * Uses the longer side so landscape and portrait map the same tiers.
 */
export function classifyClipQualityLabel(
  width: number,
  height: number,
): string {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "—";
  }
  const long = Math.max(width, height);
  if (long >= 2400) return "2K";
  if (long >= 1600) return "1080p";
  if (long >= 1100) return "720p";
  if (long >= 700) return "480p";
  return `${Math.round(long)}p`;
}
