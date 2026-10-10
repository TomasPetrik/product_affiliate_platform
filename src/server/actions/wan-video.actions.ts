"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clampWanVideoDuration,
  DEFAULT_WAN_VIDEO_ASPECT_RATIO,
  DEFAULT_WAN_VIDEO_DURATION,
  DEFAULT_WAN_VIDEO_RESOLUTION,
  MAX_WAN_VIDEO_IMAGE_BYTES,
  MAX_WAN_VIDEO_REFERENCE_IMAGES,
  WAN_VIDEO_ASPECT_RATIOS,
  WAN_VIDEO_RESOLUTIONS,
  type WanVideoAspectRatio,
  type WanVideoResolution,
} from "@/lib/wan-video";
import { extensionForMime } from "@/lib/wan-image-edit";
import {
  isLocalVideoFrameUpload,
  LOCAL_VIDEO_FRAME_UPLOAD_PREFIX,
  videoFrameProjectsUploadsDir,
} from "@/lib/video-frame-project-paths";
import {
  getWaveSpeedPrediction,
  isWaveSpeedConfigured,
  submitWanReferenceToVideo,
  uploadWaveSpeedMedia,
  WaveSpeedError,
} from "@/server/services/wavespeed.client";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export interface WanVideoSubmitState {
  error?: string;
  predictionId?: string;
  status?: string;
}

export interface WanVideoPollState {
  error?: string;
  predictionId: string;
  status: string;
  outputs: string[];
  inferenceMs?: number;
  progress?: number;
}

function absoluteFromPublicUpload(publicPath: string): string | null {
  if (!isLocalVideoFrameUpload(publicPath)) return null;
  const relative = publicPath.slice(LOCAL_VIDEO_FRAME_UPLOAD_PREFIX.length);
  if (!relative || relative.includes("..")) return null;
  return path.join(videoFrameProjectsUploadsDir(), relative);
}

async function fileToWaveSpeedUrl(
  file: File,
  fallbackName: string,
): Promise<string> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size <= 0) {
    throw new Error("Uploaded image is empty.");
  }
  if (file.size > MAX_WAN_VIDEO_IMAGE_BYTES) {
    throw new Error(
      `Image must be ${Math.round(MAX_WAN_VIDEO_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
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

async function frameAssetToWaveSpeedUrl(assetId: string): Promise<string> {
  const asset = await prisma.videoFrameAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      kind: true,
      path: true,
      fileName: true,
    },
  });

  if (!asset || (asset.kind !== "FRAME" && asset.kind !== "EDITED")) {
    throw new Error("Video frame asset not found.");
  }

  const absolute = absoluteFromPublicUpload(asset.path);
  if (!absolute) {
    throw new Error("Video frame path is invalid.");
  }

  const bytes = await readFile(absolute);
  if (bytes.byteLength > MAX_WAN_VIDEO_IMAGE_BYTES) {
    throw new Error(
      `Frame must be ${Math.round(MAX_WAN_VIDEO_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  const ext = path.extname(asset.fileName || asset.path).toLowerCase();
  const contentType = EXT_MIME[ext] ?? "image/jpeg";
  return uploadWaveSpeedMedia({
    bytes,
    filename: asset.fileName || `frame-${asset.id}${ext || ".jpg"}`,
    contentType,
  });
}

export async function submitWanVideoAction(
  formData: FormData,
): Promise<WanVideoSubmitState> {
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

    const duration = clampWanVideoDuration(
      Number(String(formData.get("duration") ?? DEFAULT_WAN_VIDEO_DURATION)),
    );

    const aspectRatio = String(
      formData.get("aspectRatio") ?? DEFAULT_WAN_VIDEO_ASPECT_RATIO,
    ).trim() as WanVideoAspectRatio;
    if (!WAN_VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
      return { error: `Aspect ratio ${aspectRatio} is not supported.` };
    }

    const resolution = String(
      formData.get("resolution") ?? DEFAULT_WAN_VIDEO_RESOLUTION,
    ).trim() as WanVideoResolution;
    if (!WAN_VIDEO_RESOLUTIONS.includes(resolution)) {
      return { error: `Resolution ${resolution} is not supported.` };
    }

    const seedRaw = String(formData.get("seed") ?? "").trim();
    let seed: number | undefined;
    if (seedRaw) {
      const parsed = Number(seedRaw);
      if (!Number.isInteger(parsed)) {
        return { error: "Seed must be an integer (or leave blank)." };
      }
      seed = parsed;
    }

    const enablePromptExpansion =
      String(formData.get("enablePromptExpansion") ?? "") === "1";
    const generateAudio = String(formData.get("generateAudio") ?? "1") !== "0";

    const referenceFiles = formData
      .getAll("referenceImages")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const referenceAssetIds = formData
      .getAll("referenceFrameAssetIds")
      .map((entry) => String(entry).trim())
      .filter(Boolean);

    const totalRefs = referenceFiles.length + referenceAssetIds.length;
    if (totalRefs === 0) {
      return {
        error: "Add at least one reference image (upload or Video creator).",
      };
    }
    if (totalRefs > MAX_WAN_VIDEO_REFERENCE_IMAGES) {
      return {
        error: `At most ${MAX_WAN_VIDEO_REFERENCE_IMAGES} reference images are allowed.`,
      };
    }

    const referenceImageUrls: string[] = [];
    for (const [index, file] of referenceFiles.entries()) {
      referenceImageUrls.push(
        await fileToWaveSpeedUrl(file, `reference-${index + 1}`),
      );
    }
    for (const assetId of referenceAssetIds) {
      referenceImageUrls.push(await frameAssetToWaveSpeedUrl(assetId));
    }

    const prediction = await submitWanReferenceToVideo({
      prompt,
      referenceImageUrls,
      resolution,
      aspectRatio,
      duration,
      enablePromptExpansion,
      generateAudio,
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
    return { error: "Failed to submit Wan video reference generation." };
  }
}

export async function pollWanVideoAction(
  predictionId: string,
): Promise<WanVideoPollState> {
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
    const prediction = await getWaveSpeedPrediction(id);
    return {
      predictionId: prediction.id,
      status: prediction.status,
      outputs: prediction.outputs,
      inferenceMs: prediction.timings?.inference,
      progress: prediction.progress,
      error: prediction.error,
    };
  } catch (error) {
    return {
      predictionId: id,
      status: "failed",
      outputs: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to poll WaveSpeed result.",
    };
  }
}
