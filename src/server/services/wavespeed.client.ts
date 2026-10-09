import { env } from "@/lib/env";
import {
  extensionForMime,
  unwrapWaveSpeedData,
  WAN_IMAGE_EDIT_SUBMIT_URL,
  WAVESPEED_MEDIA_UPLOADS_URL,
  wavespeedResultUrl,
  type WanPredictionStatus,
} from "@/lib/wan-image-edit";
import { WAN_REFERENCE_TO_VIDEO_SUBMIT_URL } from "@/lib/wan-video";
import { WAN_VIDEO_EDIT_SUBMIT_URL } from "@/lib/wan-video-edit";

export class WaveSpeedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WaveSpeedError";
  }
}

function requireApiKey(): string {
  const key = env.WAVESPEED_API_KEY;
  if (!key) {
    throw new WaveSpeedError(
      "WAVESPEED_API_KEY is not configured. Add it to .env and restart the app.",
    );
  }
  return key;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `WaveSpeed request failed (${response.status}).`;
  }
  try {
    const json = JSON.parse(text) as { message?: string; error?: string };
    return json.message || json.error || text;
  } catch {
    return text;
  }
}

interface UploadTicket {
  download_url: string;
  upload: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
  };
}

/** Upload local bytes to WaveSpeed media storage; returns a model-ready URL. */
export async function uploadWaveSpeedMedia(input: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<string> {
  const apiKey = requireApiKey();
  const filename =
    input.filename.includes(".") ?
      input.filename
    : `${input.filename}.${extensionForMime(input.contentType)}`;

  const ticketResponse = await fetch(WAVESPEED_MEDIA_UPLOADS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      size: input.bytes.byteLength,
      content_type: input.contentType,
    }),
  });

  if (!ticketResponse.ok) {
    throw new WaveSpeedError(await readErrorMessage(ticketResponse), ticketResponse.status);
  }

  const ticket = unwrapWaveSpeedData<UploadTicket>(await ticketResponse.json());
  if (!ticket?.download_url || !ticket.upload?.url) {
    throw new WaveSpeedError("WaveSpeed upload ticket was missing download_url or upload.url.");
  }

  const putResponse = await fetch(ticket.upload.url, {
    method: ticket.upload.method ?? "PUT",
    headers: ticket.upload.headers ?? { "Content-Type": input.contentType },
    body: new Uint8Array(input.bytes),
  });

  if (!putResponse.ok) {
    throw new WaveSpeedError(
      `WaveSpeed media PUT failed (${putResponse.status}).`,
      putResponse.status,
    );
  }

  return ticket.download_url;
}

export interface WanImageEditSubmitInput {
  prompt: string;
  imageUrls: string[];
  size?: string;
  seed?: number;
}

export interface WanPrediction {
  id: string;
  status: WanPredictionStatus;
  outputs: string[];
  error?: string;
  model?: string;
  created_at?: string;
  timings?: { inference?: number };
  /** 0–100 when WaveSpeed reports progress; otherwise undefined. */
  progress?: number;
}

function normalizePrediction(raw: unknown): WanPrediction {
  const data = unwrapWaveSpeedData<{
    id?: string;
    status?: string;
    outputs?: unknown;
    error?: string;
    model?: string;
    created_at?: string;
    timings?: { inference?: number };
    progress?: unknown;
  }>(raw);

  if (!data?.id) {
    throw new WaveSpeedError("WaveSpeed response did not include a prediction id.");
  }

  const outputs = Array.isArray(data.outputs)
    ? data.outputs.filter((item): item is string => typeof item === "string")
    : [];

  let progress: number | undefined;
  if (typeof data.progress === "number" && Number.isFinite(data.progress)) {
    progress = data.progress <= 1 ? Math.round(data.progress * 100) : Math.round(data.progress);
    progress = Math.min(100, Math.max(0, progress));
  }

  return {
    id: data.id,
    status: data.status ?? "created",
    outputs,
    error: data.error || undefined,
    model: data.model,
    created_at: data.created_at,
    timings: data.timings,
    progress,
  };
}

export async function submitWanImageEditPro(
  input: WanImageEditSubmitInput,
): Promise<WanPrediction> {
  const apiKey = requireApiKey();

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    images: input.imageUrls,
  };
  if (input.size) {
    body.size = input.size;
  }
  if (input.seed !== undefined) {
    body.seed = input.seed;
  }

  const response = await fetch(WAN_IMAGE_EDIT_SUBMIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new WaveSpeedError(await readErrorMessage(response), response.status);
  }

  return normalizePrediction(await response.json());
}

export async function getWanImageEditResult(predictionId: string): Promise<WanPrediction> {
  const apiKey = requireApiKey();
  const response = await fetch(wavespeedResultUrl(predictionId), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new WaveSpeedError(await readErrorMessage(response), response.status);
  }

  return normalizePrediction(await response.json());
}

/** Poll any WaveSpeed prediction (image edit, reference-to-video, …). */
export const getWaveSpeedPrediction = getWanImageEditResult;

export interface WanReferenceToVideoSubmitInput {
  prompt: string;
  referenceImageUrls: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  enablePromptExpansion?: boolean;
  generateAudio?: boolean;
  seed?: number;
}

export async function submitWanReferenceToVideo(
  input: WanReferenceToVideoSubmitInput,
): Promise<WanPrediction> {
  const apiKey = requireApiKey();

  if (
    input.referenceImageUrls.length === 0 &&
    !input.referenceVideoUrls?.length &&
    !input.referenceAudioUrls?.length
  ) {
    throw new WaveSpeedError(
      "At least one reference image, video, or audio is required.",
    );
  }

  const body: Record<string, unknown> = {
    prompt: input.prompt,
  };
  if (input.referenceImageUrls.length > 0) {
    body.reference_images = input.referenceImageUrls;
  }
  if (input.referenceVideoUrls?.length) {
    body.reference_videos = input.referenceVideoUrls;
  }
  if (input.referenceAudioUrls?.length) {
    body.reference_audios = input.referenceAudioUrls;
  }
  if (input.resolution) body.resolution = input.resolution;
  if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
  if (input.duration !== undefined) body.duration = input.duration;
  if (input.enablePromptExpansion !== undefined) {
    body.enable_prompt_expansion = input.enablePromptExpansion;
  }
  if (input.generateAudio !== undefined) {
    body.generate_audio = input.generateAudio;
  }
  if (input.seed !== undefined) body.seed = input.seed;

  const response = await fetch(WAN_REFERENCE_TO_VIDEO_SUBMIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new WaveSpeedError(await readErrorMessage(response), response.status);
  }

  return normalizePrediction(await response.json());
}

export interface WanVideoEditSubmitInput {
  prompt: string;
  videoUrl: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  resolution?: string;
  /** Omit to let WaveSpeed follow the normalized input duration. */
  duration?: number;
  enablePromptExpansion?: boolean;
  generateAudio?: boolean;
  seed?: number;
}

export async function submitWanVideoEdit(
  input: WanVideoEditSubmitInput,
): Promise<WanPrediction> {
  const apiKey = requireApiKey();

  if (!input.videoUrl.trim()) {
    throw new WaveSpeedError("A source video URL is required.");
  }
  if (!input.prompt.trim()) {
    throw new WaveSpeedError("Prompt is required.");
  }

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    video: input.videoUrl,
  };
  if (input.referenceImageUrls?.length) {
    body.reference_images = input.referenceImageUrls;
  }
  if (input.referenceAudioUrls?.length) {
    body.reference_audios = input.referenceAudioUrls;
  }
  if (input.resolution) body.resolution = input.resolution;
  if (input.duration !== undefined) body.duration = input.duration;
  if (input.enablePromptExpansion !== undefined) {
    body.enable_prompt_expansion = input.enablePromptExpansion;
  }
  if (input.generateAudio !== undefined) {
    body.generate_audio = input.generateAudio;
  }
  if (input.seed !== undefined) body.seed = input.seed;

  const response = await fetch(WAN_VIDEO_EDIT_SUBMIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new WaveSpeedError(await readErrorMessage(response), response.status);
  }

  return normalizePrediction(await response.json());
}

export function isWaveSpeedConfigured(): boolean {
  return Boolean(env.WAVESPEED_API_KEY);
}
