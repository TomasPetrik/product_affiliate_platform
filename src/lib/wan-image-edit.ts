/** Max upload size for Wan edit inputs (main + reference). */
export const MAX_WAN_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * WaveSpeed accepts up to 9 images total for this model. Main image uses one slot;
 * the rest are optional references (Figure 2, Figure 3, …).
 */
export const MAX_WAN_REFERENCE_IMAGES = 8;

/** Inclusive max for generated seeds (signed 32-bit positive range). */
export const WAN_SEED_MAX = 2_147_483_647;

/** Random positive seed for reproducible iterations (never -1). */
export function randomWanSeed(random = Math.random): number {
  return Math.floor(random() * WAN_SEED_MAX);
}

/** WaveSpeed model id for Wan 2.7 Image Edit Pro. */
export const WAN_IMAGE_EDIT_PRO_MODEL = "alibaba/wan-2.7/image-edit-pro";

export const WAN_IMAGE_EDIT_SUBMIT_URL =
  `https://api.wavespeed.ai/api/v3/${WAN_IMAGE_EDIT_PRO_MODEL}`;

export const WAVESPEED_MEDIA_UPLOADS_URL =
  "https://api.wavespeed.ai/api/v3/media/uploads";

export type WanPredictionStatus =
  | "created"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout"
  | "deleted"
  | string;

/** Preset output sizes. WaveSpeed expects `width*height`. Default is 9:16. */
export const WAN_SIZE_PRESETS = [
  { value: "720*1280", label: "720×1280 (9:16)", ratio: "9:16" },
  { value: "1080*1920", label: "1080×1920 (9:16)", ratio: "9:16" },
  { value: "1152*2048", label: "1152×2048 (9:16)", ratio: "9:16" },
  { value: "1280*720", label: "1280×720 (16:9)", ratio: "16:9" },
  { value: "1024*1024", label: "1024×1024 (1:1)", ratio: "1:1" },
] as const;

export const DEFAULT_WAN_SIZE = WAN_SIZE_PRESETS[0].value;

const SIZE_PATTERN = /^(\d+)\*(\d+)$/;

export const WAN_TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "cancelled",
  "timeout",
  "deleted",
]);

export function isWanTerminalFailure(status: string): boolean {
  return WAN_TERMINAL_FAILURE_STATUSES.has(status);
}

export function isWanCompleted(status: string): boolean {
  return status === "completed";
}

/**
 * Validates a WaveSpeed `size` string (`width*height`) against documented limits:
 * each side 512–4096, total pixels between 768² and 2048², aspect 1:8–8:1.
 */
export function validateWanSize(size: string): string | null {
  const match = SIZE_PATTERN.exec(size.trim());
  if (!match) {
    return "Size must look like 720*1280 (width*height).";
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return "Size dimensions must be numbers.";
  }

  if (width < 512 || width > 4096 || height < 512 || height > 4096) {
    return "Each side must be between 512 and 4096 pixels.";
  }

  const pixels = width * height;
  const minPixels = 768 * 768;
  const maxPixels = 2048 * 2048;
  if (pixels < minPixels || pixels > maxPixels) {
    return "Total pixels must be between 768×768 and 2048×2048.";
  }

  const ratio = width / height;
  if (ratio < 1 / 8 || ratio > 8) {
    return "Aspect ratio must be between 1:8 and 8:1.";
  }

  return null;
}

/** Normalize WaveSpeed envelope: `{ data: T }` or bare `T`. */
export function unwrapWaveSpeedData<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export function wavespeedResultUrl(predictionId: string): string {
  return `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(predictionId)}/result`;
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}
