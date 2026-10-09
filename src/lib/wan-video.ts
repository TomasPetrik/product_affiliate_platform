import {
  isWanCompleted,
  isWanTerminalFailure,
  WAN_SEED_MAX,
  randomWanSeed,
} from "@/lib/wan-image-edit";

/** WaveSpeed model: Alibaba Wan 3.0 Reference-to-Video. */
export const WAN_REFERENCE_TO_VIDEO_MODEL = "alibaba/wan-3.0/reference-to-video";

export const WAN_REFERENCE_TO_VIDEO_SUBMIT_URL =
  `https://api.wavespeed.ai/api/v3/${WAN_REFERENCE_TO_VIDEO_MODEL}`;

/** Up to 10 reference images per WaveSpeed docs. */
export const MAX_WAN_VIDEO_REFERENCE_IMAGES = 10;

/** Max size per still uploaded as a Wan video reference. */
export const MAX_WAN_VIDEO_IMAGE_BYTES = 20 * 1024 * 1024;

export const WAN_VIDEO_DURATION_MIN = 2;
export const WAN_VIDEO_DURATION_MAX = 30;
export const DEFAULT_WAN_VIDEO_DURATION = 5;

export type WanVideoResolution = "480p" | "720p" | "1080p";
export type WanVideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";

export const WAN_VIDEO_RESOLUTIONS: readonly WanVideoResolution[] = [
  "480p",
  "720p",
  "1080p",
];

export const WAN_VIDEO_ASPECT_RATIOS: readonly WanVideoAspectRatio[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
];

export const DEFAULT_WAN_VIDEO_RESOLUTION: WanVideoResolution = "720p";
export const DEFAULT_WAN_VIDEO_ASPECT_RATIO: WanVideoAspectRatio = "9:16";

export const DEFAULT_WAN_VIDEO_PROMPT =
  "Create a realistic video based on the image sequence. Keep motion natural and consistent with the reference images.";

/** Typical wall time for progress estimates while polling. */
export const WAN_VIDEO_EXPECTED_MS = 180_000;

export { WAN_SEED_MAX, randomWanSeed, isWanCompleted, isWanTerminalFailure };

export function clampWanVideoDuration(duration: number): number {
  if (!Number.isFinite(duration)) {
    return DEFAULT_WAN_VIDEO_DURATION;
  }
  return Math.min(
    WAN_VIDEO_DURATION_MAX,
    Math.max(WAN_VIDEO_DURATION_MIN, Math.round(duration)),
  );
}

export function wanVideoDurationChoices(): number[] {
  const choices: number[] = [];
  for (let d = WAN_VIDEO_DURATION_MIN; d <= WAN_VIDEO_DURATION_MAX; d += 1) {
    choices.push(d);
  }
  return choices;
}

/** Suggest duration from first→last selected frame times. */
export function suggestedWanVideoDurationFromTimes(times: number[]): number {
  const ordered = times.filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (ordered.length < 2) {
    return DEFAULT_WAN_VIDEO_DURATION;
  }
  const delta = ordered[ordered.length - 1]! - ordered[0]!;
  return clampWanVideoDuration(Math.max(1, Math.round(delta)));
}

export function estimateWanVideoProgressPercent(input: {
  status: string | null | undefined;
  startedAt: number;
  now?: number;
  apiProgress?: number | null;
  phase?: "submitting" | "polling" | "completed" | "failed" | string;
}): number {
  if (input.phase === "failed" || isWanTerminalFailure(input.status ?? "")) {
    return 0;
  }
  if (input.phase === "completed" || isWanCompleted(input.status ?? "")) {
    return 100;
  }
  if (input.phase === "saving") {
    return 97;
  }
  if (input.phase === "submitting") {
    return 6;
  }

  if (
    typeof input.apiProgress === "number" &&
    Number.isFinite(input.apiProgress)
  ) {
    return Math.min(99, Math.max(0, Math.round(input.apiProgress)));
  }

  const now = input.now ?? Date.now();
  const elapsed = Math.max(0, now - input.startedAt);
  const status = input.status ?? "created";

  if (status === "created") {
    return Math.min(18, 8 + Math.round(elapsed / 3000));
  }

  const t = elapsed / WAN_VIDEO_EXPECTED_MS;
  return Math.min(92, Math.round(20 + 72 * (1 - Math.exp(-1.6 * t))));
}

export function preferredWanVideoAspect(
  videoAspect?: number,
): WanVideoAspectRatio {
  const portrait = (videoAspect ?? 16 / 9) < 1;
  return portrait ? "9:16" : "16:9";
}
