/** Krea API base URL. */
export const KREA_API_BASE = "https://api.krea.ai";

/** Max upload size for stills sent to Krea (under Krea's 75MB asset limit). */
export const MAX_KREA_IMAGE_BYTES = 20 * 1024 * 1024;

/** Soft cap for reference images in the UI (Seedance 2.5 allows up to 30). */
export const MAX_KREA_REFERENCE_IMAGES = 9;

export const KREA_SEED_MAX = 2_147_483_647;

export function randomKreaSeed(random = Math.random): number {
  return Math.floor(random() * KREA_SEED_MAX);
}

export type KreaJobStatus =
  | "backlogged"
  | "queued"
  | "scheduled"
  | "processing"
  | "sampling"
  | "intermediate-complete"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

export const KREA_TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "cancelled",
]);

export function isKreaTerminalFailure(status: string): boolean {
  return KREA_TERMINAL_FAILURE_STATUSES.has(status);
}

export function isKreaCompleted(status: string): boolean {
  return status === "completed";
}

/** Typical wall time used for estimated progress while polling. */
export const KREA_VIDEO_EXPECTED_MS = 180_000;

export function estimateKreaVideoProgressPercent(input: {
  status: string | null | undefined;
  startedAt: number;
  now?: number;
  apiProgress?: number | null;
  phase?: "submitting" | "polling" | "completed" | "failed" | string;
}): number {
  if (input.phase === "failed" || isKreaTerminalFailure(input.status ?? "")) {
    return 0;
  }
  if (input.phase === "completed" || isKreaCompleted(input.status ?? "")) {
    return 100;
  }
  if (input.phase === "submitting") {
    return 6;
  }

  if (
    typeof input.apiProgress === "number" &&
    Number.isFinite(input.apiProgress)
  ) {
    const percent =
      input.apiProgress <= 1 ? input.apiProgress * 100 : input.apiProgress;
    return Math.min(99, Math.max(0, Math.round(percent)));
  }

  const now = input.now ?? Date.now();
  const elapsed = Math.max(0, now - input.startedAt);
  const status = input.status ?? "queued";

  if (status === "backlogged" || status === "queued" || status === "scheduled") {
    return Math.min(18, 8 + Math.round(elapsed / 3000));
  }

  const t = elapsed / KREA_VIDEO_EXPECTED_MS;
  return Math.min(92, Math.round(20 + 72 * (1 - Math.exp(-1.6 * t))));
}

export type KreaAspectRatio =
  | "adaptive"
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9"
  | "9:21";

export type KreaResolution =
  | "480p"
  | "720p"
  | "768p"
  | "1080p"
  | "4k"
  | "4K";

export interface KreaVideoModelDef {
  id: string;
  /** Path segment after /generate/video/ */
  path: string;
  label: string;
  group: "Seedance" | "Wan" | "Kling" | "Hailuo" | "Veo";
  description: string;
  durationMin: number;
  durationMax: number;
  /** When set, duration must be one of these values. */
  durationOptions?: number[];
  resolutions: KreaResolution[];
  aspectRatios: KreaAspectRatio[];
  maxReferenceImages: number;
  supportsEndImage: boolean;
  supportsEnhancePrompt: boolean;
  supportsDraft: boolean;
  supportsUpscale: boolean;
  supportsGenerateAudio: boolean;
  /** Kling quality modes. */
  modes?: Array<"std" | "pro" | "4k">;
  defaultDuration: number;
  defaultResolution: KreaResolution;
  defaultAspectRatio: KreaAspectRatio;
}

export const KREA_VIDEO_MODELS: readonly KreaVideoModelDef[] = [
  {
    id: "seedance-2-5",
    path: "bytedance/seedance-2-5",
    label: "Seedance 2.5*",
    group: "Seedance",
    description: "Best default — up to 30s, native audio, many refs, 1080p (API min 4s).",
    durationMin: 4,
    durationMax: 30,
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    maxReferenceImages: 30,
    supportsEndImage: true,
    supportsEnhancePrompt: true,
    supportsDraft: true,
    supportsUpscale: false,
    supportsGenerateAudio: false,
    defaultDuration: 5,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "seedance-2",
    path: "bytedance/seedance-2",
    label: "Seedance 2.0*",
    group: "Seedance",
    description: "Flagship Seedance with references, frame animation, optional 4K.",
    durationMin: 4,
    durationMax: 15,
    resolutions: ["480p", "720p", "1080p", "4k"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    maxReferenceImages: 9,
    supportsEndImage: true,
    supportsEnhancePrompt: true,
    supportsDraft: false,
    supportsUpscale: true,
    supportsGenerateAudio: false,
    defaultDuration: 5,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "seedance-2-fast",
    path: "bytedance/seedance-2-fast",
    label: "Seedance 2.0 Fast*",
    group: "Seedance",
    description: "Faster Seedance 2 with references and frame animation.",
    durationMin: 4,
    durationMax: 15,
    resolutions: ["480p", "720p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    maxReferenceImages: 9,
    supportsEndImage: true,
    supportsEnhancePrompt: true,
    supportsDraft: false,
    supportsUpscale: true,
    supportsGenerateAudio: false,
    defaultDuration: 5,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "seedance-2-mini",
    path: "bytedance/seedance-2-mini",
    label: "Seedance 2.0 Mini",
    group: "Seedance",
    description: "Cheaper Seedance 2 for scalable production.",
    durationMin: 4,
    durationMax: 15,
    resolutions: ["480p", "720p"],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    maxReferenceImages: 9,
    supportsEndImage: true,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: false,
    defaultDuration: 5,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "seedance-1.0-pro",
    path: "bytedance/seedance-1.0-pro",
    label: "Seedance 1.0 Pro",
    group: "Seedance",
    description: "Earlier Seedance Pro — supports short clips from 2s.",
    durationMin: 2,
    durationMax: 12,
    resolutions: ["720p", "1080p"],
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"],
    maxReferenceImages: 4,
    supportsEndImage: true,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: false,
    defaultDuration: 2,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "seedance-1.0-pro-fast",
    path: "bytedance/seedance-1.0-pro-fast",
    label: "Seedance 1.0 Pro Fast",
    group: "Seedance",
    description: "Cheapest Seedance for short clips — 2–12s (use this for 2s cuts).",
    durationMin: 2,
    durationMax: 12,
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"],
    maxReferenceImages: 0,
    supportsEndImage: false,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: false,
    defaultDuration: 2,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "wan-3.0",
    path: "alibaba/wan-3.0",
    label: "Wan 3.0",
    group: "Wan",
    description: "Alibaba Wan — 2–30s clips with native audio and references.",
    durationMin: 2,
    durationMax: 30,
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"],
    maxReferenceImages: 9,
    supportsEndImage: true,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: true,
    defaultDuration: 2,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "kling-3.0",
    path: "kling/kling-3.0",
    label: "Kling 3.0",
    group: "Kling",
    description: "Frontier Kling with audio and up to 15s (min 3s).",
    durationMin: 3,
    durationMax: 15,
    resolutions: [],
    aspectRatios: ["16:9", "9:16"],
    maxReferenceImages: 0,
    supportsEndImage: true,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: true,
    modes: ["std", "pro", "4k"],
    defaultDuration: 5,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "hailuo-2.3",
    path: "minimax/hailuo-2.3",
    label: "Hailuo 2.3",
    group: "Hailuo",
    description: "Dynamic motion; fixed 6s or 10s durations.",
    durationMin: 6,
    durationMax: 10,
    durationOptions: [6, 10],
    resolutions: ["768p", "1080p"],
    aspectRatios: ["16:9", "9:16"],
    maxReferenceImages: 0,
    supportsEndImage: true,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: false,
    defaultDuration: 6,
    defaultResolution: "768p",
    defaultAspectRatio: "9:16",
  },
  {
    id: "veo-3.1",
    path: "google/veo-3.1",
    label: "Veo 3.1",
    group: "Veo",
    description: "Highest-quality Google Veo with optional audio.",
    durationMin: 4,
    durationMax: 8,
    durationOptions: [4, 6, 8],
    resolutions: ["720p", "1080p", "4K"],
    aspectRatios: ["16:9", "9:16"],
    maxReferenceImages: 3,
    supportsEndImage: true,
    supportsEnhancePrompt: false,
    supportsDraft: false,
    supportsUpscale: false,
    supportsGenerateAudio: true,
    defaultDuration: 8,
    defaultResolution: "720p",
    defaultAspectRatio: "9:16",
  },
] as const;

export const DEFAULT_KREA_VIDEO_MODEL_ID = "seedance-2-5";

/** Default model when generating a clip from a Video frames span. */
export const DEFAULT_SPAN_CLIP_MODEL_ID = "seedance-1.0-pro";

export const DEFAULT_SPAN_CLIP_PROMPT =
  "Create a realistic video based on the image sequence. Keep motion natural and consistent with the frames.";

export function getKreaVideoModel(id: string): KreaVideoModelDef | undefined {
  return KREA_VIDEO_MODELS.find((model) => model.id === id);
}

/**
 * Suggest clip duration from the gap between the first and last selected frame times,
 * clamped to the model’s allowed range.
 */
export function suggestedKreaDurationFromTimes(
  times: number[],
  model: KreaVideoModelDef,
): number {
  const ordered = times.filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (ordered.length < 2) {
    return model.defaultDuration;
  }
  const delta = ordered[ordered.length - 1]! - ordered[0]!;
  const rounded = Math.max(1, Math.round(delta));
  return clampKreaDuration(model, rounded);
}

export function kreaVideoSubmitUrl(modelPath: string): string {
  return `${KREA_API_BASE}/generate/video/${modelPath}`;
}

export function kreaJobUrl(jobId: string): string {
  return `${KREA_API_BASE}/jobs/${encodeURIComponent(jobId)}`;
}

export function kreaAssetsUrl(): string {
  return `${KREA_API_BASE}/assets`;
}

export function clampKreaDuration(
  model: KreaVideoModelDef,
  duration: number,
): number {
  if (model.durationOptions?.length) {
    if (model.durationOptions.includes(duration)) return duration;
    return model.defaultDuration;
  }
  if (!Number.isFinite(duration)) return model.defaultDuration;
  return Math.min(model.durationMax, Math.max(model.durationMin, duration));
}

export function durationChoicesForModel(model: KreaVideoModelDef): number[] {
  if (model.durationOptions?.length) {
    return [...model.durationOptions];
  }
  const choices: number[] = [];
  for (let d = model.durationMin; d <= model.durationMax; d += 1) {
    choices.push(d);
  }
  return choices;
}
