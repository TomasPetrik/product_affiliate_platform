"use server";

import { requireAdminSession } from "@/lib/auth";
import {
  DEFAULT_WAN_SIZE,
  extensionForMime,
  isWanCompleted,
  MAX_WAN_IMAGE_BYTES,
  MAX_WAN_REFERENCE_IMAGES,
  validateWanSize,
  WAN_IMAGE_EDIT_PRO_MODEL,
} from "@/lib/wan-image-edit";
import {
  getWanImageEditResult,
  isWaveSpeedConfigured,
  resolveWaveSpeedCostUsd,
  submitWanImageEditPro,
  uploadWaveSpeedMedia,
  WaveSpeedError,
} from "@/server/services/wavespeed.client";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface WanImageEditSubmitState {
  error?: string;
  predictionId?: string;
  status?: string;
}

export interface WanImageEditPollState {
  error?: string;
  predictionId: string;
  status: string;
  outputs: string[];
  inferenceMs?: number;
  /** 0–100 when WaveSpeed reports it. */
  progress?: number;
  /** USD charged / estimated for this prediction. */
  costUsd?: number;
}

async function fileToUpload(file: File, fallbackName: string) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size <= 0) {
    throw new Error("Uploaded image is empty.");
  }
  if (file.size > MAX_WAN_IMAGE_BYTES) {
    throw new Error(
      `Image must be ${Math.round(MAX_WAN_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename =
    file.name?.trim() ||
    `${fallbackName}.${extensionForMime(file.type)}`;

  return uploadWaveSpeedMedia({
    bytes,
    filename,
    contentType: file.type,
  });
}

export async function submitWanImageEditAction(
  formData: FormData,
): Promise<WanImageEditSubmitState> {
  await requireAdminSession();

  if (!isWaveSpeedConfigured()) {
    return {
      error:
        "WAVESPEED_API_KEY is not configured. Add it to .env and restart the app.",
    };
  }

  try {
    const prompt = String(formData.get("prompt") ?? "").trim();
    if (!prompt) {
      return { error: "Prompt is required." };
    }

    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return { error: "Choose a main image (frame) to edit." };
    }

    const sizeRaw = String(formData.get("size") ?? DEFAULT_WAN_SIZE).trim();
    const size = sizeRaw || DEFAULT_WAN_SIZE;
    const sizeError = validateWanSize(size);
    if (sizeError) {
      return { error: sizeError };
    }

    const seedRaw = String(formData.get("seed") ?? "").trim();
    let seed: number | undefined;
    if (seedRaw) {
      const parsed = Number(seedRaw);
      if (!Number.isInteger(parsed)) {
        return { error: "Seed must be an integer (or leave blank / -1)." };
      }
      seed = parsed;
    }

    const imageUrls: string[] = [await fileToUpload(image, "frame")];

    const references = formData
      .getAll("referenceImages")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (references.length > MAX_WAN_REFERENCE_IMAGES) {
      return {
        error: `At most ${MAX_WAN_REFERENCE_IMAGES} reference images are allowed.`,
      };
    }

    for (const [index, reference] of references.entries()) {
      imageUrls.push(await fileToUpload(reference, `reference-${index + 1}`));
    }

    const prediction = await submitWanImageEditPro({
      prompt,
      imageUrls,
      size,
      seed,
    });

    return {
      predictionId: prediction.id,
      status: prediction.status,
    };
  } catch (error) {
    if (error instanceof WaveSpeedError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to submit Wan image edit." };
  }
}

export async function pollWanImageEditAction(
  predictionId: string,
): Promise<WanImageEditPollState> {
  await requireAdminSession();

  const id = predictionId.trim();
  if (!id) {
    return {
      error: "Missing prediction id.",
      predictionId: "",
      status: "failed",
      outputs: [],
    };
  }

  if (!isWaveSpeedConfigured()) {
    return {
      error: "WAVESPEED_API_KEY is not configured.",
      predictionId: id,
      status: "failed",
      outputs: [],
    };
  }

  try {
    const prediction = await getWanImageEditResult(id);
    let costUsd: number | undefined;
    if (isWanCompleted(prediction.status)) {
      costUsd =
        (await resolveWaveSpeedCostUsd({
          predictionId: prediction.id,
          predictionCostUsd: prediction.costUsd,
          modelId: prediction.model ?? WAN_IMAGE_EDIT_PRO_MODEL,
        })) ?? undefined;
    }
    return {
      predictionId: prediction.id,
      status: prediction.status,
      outputs: prediction.outputs,
      inferenceMs: prediction.timings?.inference,
      progress: prediction.progress,
      costUsd,
      error: prediction.error,
    };
  } catch (error) {
    return {
      predictionId: id,
      status: "failed",
      outputs: [],
      error:
        error instanceof Error ? error.message : "Failed to poll WaveSpeed result.",
    };
  }
}
