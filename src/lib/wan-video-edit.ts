import {
  isWanCompleted,
  isWanTerminalFailure,
  WAN_SEED_MAX,
  randomWanSeed,
} from "@/lib/wan-image-edit";
import {
  DEFAULT_WAN_VIDEO_RESOLUTION,
  WAN_VIDEO_RESOLUTIONS,
  type WanVideoResolution,
} from "@/lib/wan-video";

/** WaveSpeed model: Alibaba Wan 3.0 Video Edit. */
export const WAN_VIDEO_EDIT_MODEL = "alibaba/wan-3.0/video-edit";

export const WAN_VIDEO_EDIT_SUBMIT_URL =
  `https://api.wavespeed.ai/api/v3/${WAN_VIDEO_EDIT_MODEL}`;

/** Up to 10 reference images per WaveSpeed docs. */
export const MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES = 10;

/** Up to 5 reference audio clips; combined ≤ 15s. */
export const MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS = 5;

export const MAX_WAN_VIDEO_EDIT_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_WAN_VIDEO_EDIT_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_WAN_VIDEO_EDIT_AUDIO_BYTES = 20 * 1024 * 1024;

/** Input video longer than this is trimmed by WaveSpeed to the first N seconds. */
export const WAN_VIDEO_EDIT_INPUT_MAX_SEC = 15;

export const WAN_VIDEO_EDIT_DURATION_MIN = 2;
export const WAN_VIDEO_EDIT_DURATION_MAX = 15;

export type WanVideoEditResolution = WanVideoResolution;

export const WAN_VIDEO_EDIT_RESOLUTIONS = WAN_VIDEO_RESOLUTIONS;
export const DEFAULT_WAN_VIDEO_EDIT_RESOLUTION: WanVideoEditResolution =
  DEFAULT_WAN_VIDEO_RESOLUTION;

export const DEFAULT_WAN_VIDEO_EDIT_PROMPT =
  "Edit video 1: make the lighting warm golden-hour sunlight. Preserve the original subjects, composition, actions and camera motion.";

/** Typical wall time for progress estimates while polling. */
export const WAN_VIDEO_EDIT_EXPECTED_MS = 200_000;

export { WAN_SEED_MAX, randomWanSeed, isWanCompleted, isWanTerminalFailure };

/**
 * Clamp output duration to 2–15. Pass `null`/`undefined`/NaN to mean “auto”
 * (omit duration and let WaveSpeed follow the input length).
 */
export function clampWanVideoEditDuration(
  duration: number | null | undefined,
): number | null {
  if (duration == null || !Number.isFinite(duration)) {
    return null;
  }
  return Math.min(
    WAN_VIDEO_EDIT_DURATION_MAX,
    Math.max(WAN_VIDEO_EDIT_DURATION_MIN, Math.round(duration)),
  );
}

export function wanVideoEditDurationChoices(): number[] {
  const choices: number[] = [];
  for (
    let d = WAN_VIDEO_EDIT_DURATION_MIN;
    d <= WAN_VIDEO_EDIT_DURATION_MAX;
    d += 1
  ) {
    choices.push(d);
  }
  return choices;
}

/** Suggest output duration from a cut length (first→last frame). */
export function suggestedWanVideoEditDuration(
  startSec: number,
  endSec: number,
): number {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return WAN_VIDEO_EDIT_DURATION_MIN;
  }
  const delta = Math.max(0, endSec - startSec);
  return (
    clampWanVideoEditDuration(Math.max(1, Math.round(delta))) ??
    WAN_VIDEO_EDIT_DURATION_MIN
  );
}

export function estimateWanVideoEditProgressPercent(input: {
  status: string | null | undefined;
  startedAt: number;
  now?: number;
  apiProgress?: number | null;
  phase?: "submitting" | "polling" | "saving" | "completed" | "failed" | string;
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
    return 8;
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

  const t = elapsed / WAN_VIDEO_EDIT_EXPECTED_MS;
  return Math.min(92, Math.round(20 + 72 * (1 - Math.exp(-1.6 * t))));
}
