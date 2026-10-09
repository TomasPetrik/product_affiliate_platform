"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireAdminSession } from "@/lib/auth";
import {
  clampKreaDuration,
  getKreaVideoModel,
  MAX_KREA_IMAGE_BYTES,
  MAX_KREA_REFERENCE_IMAGES,
  type KreaAspectRatio,
  type KreaResolution,
} from "@/lib/krea-video";
import {
  isLocalVideoFrameUpload,
  LOCAL_VIDEO_FRAME_UPLOAD_PREFIX,
  videoFrameProjectsUploadsDir,
} from "@/lib/video-frame-project-paths";
import { prisma } from "@/lib/prisma";
import {
  getKreaJob,
  isKreaConfigured,
  KreaError,
  submitKreaVideo,
  uploadKreaAsset,
} from "@/server/services/krea.client";
import {
  listVideoFrameProjects,
  type VideoFrameProjectListItem,
} from "@/server/services/video-frame-project.service";

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

export interface KreaVideoSubmitState {
  error?: string;
  jobId?: string;
  status?: string;
}

export interface KreaVideoPollState {
  error?: string;
  jobId: string;
  status: string;
  urls: string[];
  progress?: number | null;
}

export interface KreaFrameOption {
  id: string;
  fileName: string;
  path: string;
  thumbPath: string | null;
  timeSec: number;
  frameIndex: number | null;
  width: number | null;
  height: number | null;
}

export interface KreaFrameProjectOption {
  id: string;
  name: string;
  frameCount: number;
  updatedAt: string;
}

function absoluteFromPublicUpload(publicPath: string): string | null {
  if (!isLocalVideoFrameUpload(publicPath)) return null;
  const relative = publicPath.slice(LOCAL_VIDEO_FRAME_UPLOAD_PREFIX.length);
  if (!relative || relative.includes("..")) return null;
  return path.join(videoFrameProjectsUploadsDir(), relative);
}

async function fileToKreaUrl(file: File, fallbackName: string): Promise<string> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size <= 0) {
    throw new Error("Uploaded image is empty.");
  }
  if (file.size > MAX_KREA_IMAGE_BYTES) {
    throw new Error(
      `Image must be ${Math.round(MAX_KREA_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name?.trim() || fallbackName;
  const uploaded = await uploadKreaAsset({
    bytes,
    filename,
    contentType: file.type,
  });
  return uploaded.imageUrl;
}

async function frameAssetToKreaUrl(assetId: string): Promise<string> {
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
  if (bytes.byteLength > MAX_KREA_IMAGE_BYTES) {
    throw new Error(
      `Frame must be ${Math.round(MAX_KREA_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  const ext = path.extname(asset.fileName || asset.path).toLowerCase();
  const contentType = EXT_MIME[ext] ?? "image/jpeg";
  const uploaded = await uploadKreaAsset({
    bytes,
    filename: asset.fileName || `frame-${asset.id}${ext || ".jpg"}`,
    contentType,
  });
  return uploaded.imageUrl;
}

async function resolveImageUrl(input: {
  file: FormDataEntryValue | null;
  assetId: string;
  fallbackName: string;
}): Promise<string | undefined> {
  const assetId = input.assetId.trim();
  if (assetId) {
    return frameAssetToKreaUrl(assetId);
  }
  if (input.file instanceof File && input.file.size > 0) {
    return fileToKreaUrl(input.file, input.fallbackName);
  }
  return undefined;
}

export async function listKreaFrameProjectsAction(): Promise<{
  error?: string;
  projects: KreaFrameProjectOption[];
}> {
  await requireAdminSession();
  try {
    const projects: VideoFrameProjectListItem[] = await listVideoFrameProjects();
    return {
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        frameCount: project.frameCount,
        updatedAt: project.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      projects: [],
      error:
        error instanceof Error ? error.message : "Failed to list video frame projects.",
    };
  }
}

export async function listKreaFramesForProjectAction(
  projectId: string,
): Promise<{ error?: string; frames: KreaFrameOption[] }> {
  await requireAdminSession();

  const id = projectId.trim();
  if (!id) {
    return { error: "Missing project id.", frames: [] };
  }

  try {
    const assets = await prisma.videoFrameAsset.findMany({
      where: {
        projectId: id,
        kind: { in: ["FRAME", "THUMBNAIL", "EDITED"] },
      },
      orderBy: [{ timeSec: "asc" }, { frameIndex: "asc" }],
      select: {
        id: true,
        kind: true,
        fileName: true,
        path: true,
        timeSec: true,
        frameIndex: true,
        width: true,
        height: true,
        spanId: true,
      },
    });

    const thumbs = assets.filter((asset) => asset.kind === "THUMBNAIL");
    const frames = assets.filter(
      (asset) => asset.kind === "FRAME" || asset.kind === "EDITED",
    );

    function thumbFor(frame: (typeof frames)[number]): string | null {
      const match = thumbs.find(
        (thumb) =>
          thumb.frameIndex === frame.frameIndex &&
          thumb.spanId === frame.spanId &&
          Math.abs(thumb.timeSec - frame.timeSec) < 0.05,
      );
      return match?.path ?? null;
    }

    return {
      frames: frames.map((frame) => ({
        id: frame.id,
        fileName: frame.fileName,
        path: frame.path,
        thumbPath: thumbFor(frame),
        timeSec: frame.timeSec,
        frameIndex: frame.frameIndex,
        width: frame.width,
        height: frame.height,
      })),
    };
  } catch (error) {
    return {
      frames: [],
      error:
        error instanceof Error ? error.message : "Failed to list project frames.",
    };
  }
}

export async function submitKreaVideoAction(
  formData: FormData,
): Promise<KreaVideoSubmitState> {
  await requireAdminSession();

  if (!isKreaConfigured()) {
    return {
      error: "KREA_API_KEY is not configured. Add it to .env and restart the app.",
    };
  }

  try {
    const prompt = String(formData.get("prompt") ?? "").trim();
    if (!prompt) {
      return { error: "Prompt is required." };
    }

    const modelId = String(formData.get("modelId") ?? "").trim();
    const model = getKreaVideoModel(modelId);
    if (!model) {
      return { error: "Choose a valid video model." };
    }

    const durationRaw = Number(String(formData.get("duration") ?? model.defaultDuration));
    const duration = clampKreaDuration(model, durationRaw);

    const aspectRatio = String(
      formData.get("aspectRatio") ?? model.defaultAspectRatio,
    ).trim() as KreaAspectRatio;
    if (!model.aspectRatios.includes(aspectRatio)) {
      return { error: `Aspect ratio ${aspectRatio} is not supported by ${model.label}.` };
    }

    let resolution: KreaResolution | undefined;
    if (model.resolutions.length > 0) {
      const resolutionRaw = String(
        formData.get("resolution") ?? model.defaultResolution,
      ).trim() as KreaResolution;
      if (!model.resolutions.includes(resolutionRaw)) {
        return { error: `Resolution ${resolutionRaw} is not supported by ${model.label}.` };
      }
      resolution = resolutionRaw;
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

    const enhancePrompt = String(formData.get("enhancePrompt") ?? "") === "1";
    const draft = String(formData.get("draft") ?? "") === "1";
    const upscale = String(formData.get("upscale") ?? "") === "1";
    const generateAudio = String(formData.get("generateAudio") ?? "") === "1";

    let mode: string | undefined;
    if (model.modes?.length) {
      const modeRaw = String(formData.get("mode") ?? "std").trim();
      if (!model.modes.includes(modeRaw as "std" | "pro" | "4k")) {
        return { error: `Mode ${modeRaw} is not supported by ${model.label}.` };
      }
      mode = modeRaw;
    }

    const startImageUrl = await resolveImageUrl({
      file: formData.get("startImage"),
      assetId: String(formData.get("startFrameAssetId") ?? ""),
      fallbackName: "start-frame.jpg",
    });

    let endImageUrl: string | undefined;
    if (model.supportsEndImage) {
      endImageUrl = await resolveImageUrl({
        file: formData.get("endImage"),
        assetId: String(formData.get("endFrameAssetId") ?? ""),
        fallbackName: "end-frame.jpg",
      });
    }

    const referenceImageUrls: string[] = [];
    if (model.maxReferenceImages > 0) {
      const referenceFiles = formData
        .getAll("referenceImages")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const referenceAssetIds = formData
        .getAll("referenceFrameAssetIds")
        .map((entry) => String(entry).trim())
        .filter(Boolean);

      const totalRefs = referenceFiles.length + referenceAssetIds.length;
      const maxRefs = Math.min(model.maxReferenceImages, MAX_KREA_REFERENCE_IMAGES);
      if (totalRefs > maxRefs) {
        return {
          error: `At most ${maxRefs} reference images are allowed for ${model.label}.`,
        };
      }

      for (const [index, file] of referenceFiles.entries()) {
        referenceImageUrls.push(
          await fileToKreaUrl(file, `reference-${index + 1}.jpg`),
        );
      }
      for (const assetId of referenceAssetIds) {
        referenceImageUrls.push(await frameAssetToKreaUrl(assetId));
      }
    }

    const job = await submitKreaVideo({
      modelPath: model.path,
      prompt,
      startImageUrl,
      endImageUrl,
      referenceImageUrls:
        referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      aspectRatio,
      duration,
      resolution,
      seed,
      enhancePrompt: model.supportsEnhancePrompt ? enhancePrompt : undefined,
      draft: model.supportsDraft ? draft : undefined,
      upscale: model.supportsUpscale ? upscale : undefined,
      generateAudio: model.supportsGenerateAudio ? generateAudio : undefined,
      mode,
    });

    return {
      jobId: job.jobId,
      status: job.status,
    };
  } catch (error) {
    if (error instanceof KreaError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to submit Krea video generation." };
  }
}

export async function pollKreaVideoAction(
  jobId: string,
): Promise<KreaVideoPollState> {
  await requireAdminSession();

  const id = jobId.trim();
  if (!id) {
    return {
      error: "Missing job id.",
      jobId: "",
      status: "failed",
      urls: [],
    };
  }

  if (!isKreaConfigured()) {
    return {
      error: "KREA_API_KEY is not configured.",
      jobId: id,
      status: "failed",
      urls: [],
    };
  }

  try {
    const job = await getKreaJob(id);
    return {
      jobId: job.jobId,
      status: job.status,
      urls: job.urls,
      progress: job.progress,
      error: job.error,
    };
  } catch (error) {
    return {
      jobId: id,
      status: "failed",
      urls: [],
      error:
        error instanceof Error ? error.message : "Failed to poll Krea job.",
    };
  }
}
