"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extensionForMime } from "@/lib/wan-image-edit";
import {
  clampWanVideoEditDuration,
  DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
  MAX_WAN_VIDEO_EDIT_AUDIO_BYTES,
  MAX_WAN_VIDEO_EDIT_IMAGE_BYTES,
  MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS,
  MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES,
  MAX_WAN_VIDEO_EDIT_VIDEO_BYTES,
  WAN_VIDEO_EDIT_INPUT_MAX_SEC,
  WAN_VIDEO_EDIT_RESOLUTIONS,
  type WanVideoEditResolution,
} from "@/lib/wan-video-edit";
import {
  isLocalVideoFrameUpload,
  LOCAL_VIDEO_FRAME_UPLOAD_PREFIX,
  videoFrameProjectsUploadsDir,
} from "@/lib/video-frame-project-paths";
import {
  cutVideoSegment,
  VideoCutError,
} from "@/server/services/video-cut.service";
import {
  getWaveSpeedPrediction,
  isWaveSpeedConfigured,
  submitWanVideoEdit,
  uploadWaveSpeedMedia,
  WaveSpeedError,
} from "@/server/services/wavespeed.client";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
]);

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export interface WanVideoEditSubmitState {
  error?: string;
  predictionId?: string;
  status?: string;
}

export interface WanVideoEditPollState {
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

async function uploadBytes(input: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<string> {
  return uploadWaveSpeedMedia(input);
}

async function fileToWaveSpeedUrl(
  file: File,
  fallbackName: string,
  kind: "image" | "video" | "audio",
): Promise<string> {
  const type = file.type || "application/octet-stream";
  if (kind === "image" && !IMAGE_TYPES.has(type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (kind === "video" && !VIDEO_TYPES.has(type) && !type.startsWith("video/")) {
    throw new Error("Use an MP4, MOV, or WebM video.");
  }
  if (kind === "audio" && !AUDIO_TYPES.has(type) && !type.startsWith("audio/")) {
    throw new Error("Use an MP3, WAV, AAC, or OGG audio file.");
  }
  if (file.size <= 0) {
    throw new Error(`Uploaded ${kind} is empty.`);
  }
  const max =
    kind === "video"
      ? MAX_WAN_VIDEO_EDIT_VIDEO_BYTES
      : kind === "audio"
        ? MAX_WAN_VIDEO_EDIT_AUDIO_BYTES
        : MAX_WAN_VIDEO_EDIT_IMAGE_BYTES;
  if (file.size > max) {
    throw new Error(
      `${kind === "video" ? "Video" : kind === "audio" ? "Audio" : "Image"} must be ${Math.round(max / (1024 * 1024))}MB or smaller.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename =
    file.name?.trim() ||
    `${fallbackName}.${extensionForMime(type) || (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "jpg")}`;

  return uploadBytes({
    bytes,
    filename,
    contentType: type,
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
  if (bytes.byteLength > MAX_WAN_VIDEO_EDIT_IMAGE_BYTES) {
    throw new Error(
      `Frame must be ${Math.round(MAX_WAN_VIDEO_EDIT_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  const ext = path.extname(asset.fileName || asset.path).toLowerCase();
  const contentType = EXT_MIME[ext] ?? "image/jpeg";
  return uploadBytes({
    bytes,
    filename: asset.fileName || `frame-${asset.id}${ext || ".jpg"}`,
    contentType,
  });
}

async function cutProjectSpanToWaveSpeedUrl(input: {
  projectId: string;
  startSec: number;
  endSec: number;
}): Promise<string> {
  const project = await prisma.videoFrameProject.findUnique({
    where: { id: input.projectId },
    select: { id: true, videoPath: true, videoFileName: true },
  });
  if (!project?.videoPath) {
    throw new Error("Project source video not found.");
  }

  const absolute = absoluteFromPublicUpload(project.videoPath);
  if (!absolute) {
    throw new Error("Project video path is invalid.");
  }

  const cut = await cutVideoSegment({
    absoluteSourcePath: absolute,
    startSec: input.startSec,
    endSec: input.endSec,
  });

  if (cut.bytes.byteLength > MAX_WAN_VIDEO_EDIT_VIDEO_BYTES) {
    throw new Error(
      `Cut video must be ${Math.round(MAX_WAN_VIDEO_EDIT_VIDEO_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  return uploadBytes({
    bytes: cut.bytes,
    filename: cut.filename,
    contentType: cut.contentType,
  });
}

export async function submitWanVideoEditAction(
  formData: FormData,
): Promise<WanVideoEditSubmitState> {
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

    const durationRaw = String(formData.get("duration") ?? "").trim();
    const duration =
      durationRaw === "" || durationRaw === "auto"
        ? null
        : clampWanVideoEditDuration(Number(durationRaw));
    if (durationRaw && durationRaw !== "auto" && duration == null) {
      return { error: "Duration must be 2–15 seconds, or auto." };
    }

    const resolution = String(
      formData.get("resolution") ?? DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
    ).trim() as WanVideoEditResolution;
    if (!WAN_VIDEO_EDIT_RESOLUTIONS.includes(resolution)) {
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

    const videoFile = formData.get("video");
    const projectId = String(formData.get("projectId") ?? "").trim();
    const cutStartSec = Number(String(formData.get("cutStartSec") ?? ""));
    const cutEndSec = Number(String(formData.get("cutEndSec") ?? ""));

    let videoUrl: string;
    if (videoFile instanceof File && videoFile.size > 0) {
      videoUrl = await fileToWaveSpeedUrl(videoFile, "source-video", "video");
    } else if (projectId && Number.isFinite(cutStartSec) && Number.isFinite(cutEndSec)) {
      if (cutEndSec - cutStartSec > WAN_VIDEO_EDIT_INPUT_MAX_SEC + 0.05) {
        return {
          error: `Span cut is too long (max ${WAN_VIDEO_EDIT_INPUT_MAX_SEC}s for Wan video edit).`,
        };
      }
      videoUrl = await cutProjectSpanToWaveSpeedUrl({
        projectId,
        startSec: cutStartSec,
        endSec: cutEndSec,
      });
    } else {
      return {
        error:
          "Provide a source video upload, or a Video frames project cut range.",
      };
    }

    const referenceFiles = formData
      .getAll("referenceImages")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const referenceAssetIds = formData
      .getAll("referenceFrameAssetIds")
      .map((entry) => String(entry).trim())
      .filter(Boolean);
    const referenceAudios = formData
      .getAll("referenceAudios")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const totalImages = referenceFiles.length + referenceAssetIds.length;
    if (totalImages > MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES) {
      return {
        error: `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES} reference images are allowed.`,
      };
    }
    if (referenceAudios.length > MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS) {
      return {
        error: `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS} reference audio clips are allowed.`,
      };
    }

    const referenceImageUrls: string[] = [];
    for (const [index, file] of referenceFiles.entries()) {
      referenceImageUrls.push(
        await fileToWaveSpeedUrl(file, `reference-${index + 1}`, "image"),
      );
    }
    for (const assetId of referenceAssetIds) {
      referenceImageUrls.push(await frameAssetToWaveSpeedUrl(assetId));
    }

    const referenceAudioUrls: string[] = [];
    for (const [index, file] of referenceAudios.entries()) {
      referenceAudioUrls.push(
        await fileToWaveSpeedUrl(file, `audio-${index + 1}`, "audio"),
      );
    }

    const prediction = await submitWanVideoEdit({
      prompt,
      videoUrl,
      referenceImageUrls,
      referenceAudioUrls,
      resolution,
      duration: duration ?? undefined,
      enablePromptExpansion,
      generateAudio,
      seed,
    });

    return {
      predictionId: prediction.id,
      status: prediction.status,
    };
  } catch (error) {
    if (
      error instanceof WaveSpeedError ||
      error instanceof VideoCutError ||
      error instanceof Error
    ) {
      return { error: error.message };
    }
    return { error: "Failed to submit Wan video edit." };
  }
}

export async function pollWanVideoEditAction(
  predictionId: string,
): Promise<WanVideoEditPollState> {
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
