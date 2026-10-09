import { env } from "@/lib/env";
import {
  kreaAssetsUrl,
  kreaJobUrl,
  kreaVideoSubmitUrl,
  type KreaJobStatus,
} from "@/lib/krea-video";

export class KreaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KreaError";
  }
}

function requireApiKey(): string {
  const key = env.KREA_API_KEY;
  if (!key) {
    throw new KreaError(
      "KREA_API_KEY is not configured. Add it to .env and restart the app.",
    );
  }
  return key;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Krea request failed (${response.status}).`;
  }
  try {
    const json = JSON.parse(text) as {
      error?: string | { code?: string; message?: string };
      message?: string;
    };
    if (typeof json.error === "string") return json.error;
    if (json.error && typeof json.error === "object") {
      return json.error.message || json.error.code || text;
    }
    return json.message || text;
  } catch {
    return text;
  }
}

export interface KreaAssetUploadResult {
  id: string;
  imageUrl: string;
}

/** Upload local bytes to Krea assets; returns a model-ready image_url. */
export async function uploadKreaAsset(input: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<KreaAssetUploadResult> {
  const apiKey = requireApiKey();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.bytes)], {
    type: input.contentType,
  });
  form.append("file", blob, input.filename);

  const response = await fetch(kreaAssetsUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw new KreaError(await readErrorMessage(response), response.status);
  }

  const json = (await response.json()) as {
    id?: string;
    image_url?: string;
  };
  if (!json.id || !json.image_url) {
    throw new KreaError("Krea asset upload did not return id/image_url.");
  }

  return { id: json.id, imageUrl: json.image_url };
}

export interface KreaVideoSubmitInput {
  modelPath: string;
  prompt: string;
  startImageUrl?: string;
  endImageUrl?: string;
  referenceImageUrls?: string[];
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  seed?: number;
  enhancePrompt?: boolean;
  draft?: boolean;
  upscale?: boolean;
  generateAudio?: boolean;
  mode?: string;
}

export interface KreaJob {
  jobId: string;
  status: KreaJobStatus;
  createdAt?: string;
  completedAt?: string | null;
  urls: string[];
  error?: string;
  /** 0–1 when Krea reports progress. */
  progress?: number | null;
}

function normalizeResultUrls(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const urls = (result as { urls?: unknown }).urls;
  if (!urls) return [];

  if (Array.isArray(urls)) {
    const out: string[] = [];
    for (const item of urls) {
      if (typeof item === "string") {
        out.push(item);
      } else if (
        item &&
        typeof item === "object" &&
        typeof (item as { url?: unknown }).url === "string"
      ) {
        out.push((item as { url: string }).url);
      }
    }
    return out;
  }

  if (typeof urls === "object") {
    return Object.values(urls as Record<string, unknown>).filter(
      (value): value is string => typeof value === "string",
    );
  }

  return [];
}

function normalizeJob(raw: unknown): KreaJob {
  if (!raw || typeof raw !== "object") {
    throw new KreaError("Krea response was empty.");
  }
  const data = raw as {
    job_id?: string;
    status?: string;
    created_at?: string;
    completed_at?: string | null;
    result?: unknown;
    error?: { code?: string; message?: string } | null;
    progress?: number | null;
  };

  if (!data.job_id) {
    throw new KreaError("Krea response did not include a job_id.");
  }

  const errorMessage =
    data.error?.message || data.error?.code || undefined;

  return {
    jobId: data.job_id,
    status: data.status ?? "queued",
    createdAt: data.created_at,
    completedAt: data.completed_at,
    urls: normalizeResultUrls(data.result),
    error: errorMessage,
    progress: typeof data.progress === "number" ? data.progress : null,
  };
}

export async function submitKreaVideo(
  input: KreaVideoSubmitInput,
): Promise<KreaJob> {
  const apiKey = requireApiKey();

  const body: Record<string, unknown> = {
    prompt: input.prompt,
  };
  if (input.startImageUrl) body.start_image = input.startImageUrl;
  if (input.endImageUrl) body.end_image = input.endImageUrl;
  if (input.referenceImageUrls?.length) {
    body.reference_images = input.referenceImageUrls;
  }
  if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
  if (input.duration !== undefined) body.duration = input.duration;
  if (input.resolution) body.resolution = input.resolution;
  if (input.seed !== undefined) body.seed = input.seed;
  if (input.enhancePrompt) body.enhance_prompt = true;
  if (input.draft) body.draft = true;
  if (input.upscale) body.upscale = true;
  if (input.generateAudio) body.generate_audio = true;
  if (input.mode) body.mode = input.mode;

  const response = await fetch(kreaVideoSubmitUrl(input.modelPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new KreaError(await readErrorMessage(response), response.status);
  }

  return normalizeJob(await response.json());
}

export async function getKreaJob(jobId: string): Promise<KreaJob> {
  const apiKey = requireApiKey();
  const response = await fetch(kreaJobUrl(jobId), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new KreaError(await readErrorMessage(response), response.status);
  }

  return normalizeJob(await response.json());
}

export function isKreaConfigured(): boolean {
  return Boolean(env.KREA_API_KEY);
}
