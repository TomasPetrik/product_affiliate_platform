/** Per-clip playback / export speed for Video merger. */

export const MIN_MERGE_CLIP_SPEED = 0.5;
export const MAX_MERGE_CLIP_SPEED = 4;
export const DEFAULT_MERGE_CLIP_SPEED = 1;

export function clampMergeClipSpeed(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_MERGE_CLIP_SPEED;
  return Math.min(MAX_MERGE_CLIP_SPEED, Math.max(MIN_MERGE_CLIP_SPEED, value));
}

/** Source trim length in seconds. */
export function mergeClipSourceKeptSec(
  trimStartSec: number,
  trimEndSec: number,
): number {
  return Math.max(0, trimEndSec - trimStartSec);
}

/** How long the clip occupies on the composition timeline. */
export function mergeClipTimelineDurationSec(
  trimStartSec: number,
  trimEndSec: number,
  speed: number | null | undefined,
): number {
  const kept = mergeClipSourceKeptSec(trimStartSec, trimEndSec);
  const rate = clampMergeClipSpeed(speed);
  return kept / rate;
}

/**
 * ffmpeg `atempo` accepts roughly 0.5–2.0 per filter; chain filters for 0.5–4×.
 * Returns null when speed is ~1 (no audio filter needed).
 */
export function ffmpegAtempoFilter(speed: number | null | undefined): string | null {
  let remaining = clampMergeClipSpeed(speed);
  if (Math.abs(remaining - 1) < 0.001) return null;

  const parts: string[] = [];
  while (remaining > 2.0001) {
    parts.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.4999) {
    parts.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) >= 0.001) {
    parts.push(`atempo=${Number(remaining.toFixed(4))}`);
  }
  return parts.length > 0 ? parts.join(",") : null;
}
