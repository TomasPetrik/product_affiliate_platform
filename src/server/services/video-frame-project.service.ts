import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { Prisma } from "@/generated/prisma/client";
import type { VideoFrameAssetKind } from "@/generated/prisma/enums";
import {
  isLocalVideoFrameUpload,
  LOCAL_VIDEO_FRAME_UPLOAD_PREFIX,
  MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES,
  MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES,
  publicVideoFramePath,
  videoFrameProjectDir,
  videoFrameProjectsUploadsDir,
} from "@/lib/video-frame-project-paths";
import type { FrameSpan } from "@/lib/video-frames";
import {
  emptyVideoFrameMergerState,
  parseVideoFrameMergerState,
  sanitizeVideoFrameMergerState,
  type VideoFrameMergerState,
} from "@/lib/video-frame-merger-state";
import {
  DEFAULT_MERGE_EXPORT_QUALITY,
  parseMergeExportQuality,
  type MergeExportQuality,
} from "@/lib/video-frame-merge-quality";
import { prisma } from "@/lib/prisma";
import {
  concatVideoSegments,
  VideoCutError,
  type SoundtrackMixInput,
} from "@/server/services/video-cut.service";

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/x-m4a",
  "audio/m4a",
]);

const THUMB_MAX_WIDTH = 384;

export interface VideoFrameProjectListItem {
  id: string;
  name: string;
  videoFileName: string | null;
  durationSec: number;
  spanCount: number;
  frameCount: number;
  videoBytes: number;
  framesBytes: number;
  thumbnailsBytes: number;
  totalBytes: number;
  updatedAt: Date;
  createdAt: Date;
}

export interface VideoFrameProjectAssetDto {
  id: string;
  kind: VideoFrameAssetKind;
  spanId: string | null;
  frameIndex: number | null;
  timeSec: number;
  fileName: string;
  label: string | null;
  path: string;
  bytes: number;
  width: number | null;
  height: number | null;
  /** WaveSpeed USD charge when this asset came from a Wan generation. */
  costUsd: number | null;
}

export interface VideoFrameProjectDetail {
  id: string;
  name: string;
  videoFileName: string | null;
  videoMimeType: string | null;
  videoPath: string | null;
  videoBytes: number;
  durationSec: number;
  videoWidth: number | null;
  videoHeight: number | null;
  spans: FrameSpan[];
  merger: VideoFrameMergerState;
  framesBytes: number;
  thumbnailsBytes: number;
  editedBytes: number;
  clipsBytes: number;
  totalBytes: number;
  /** Sum of WaveSpeed costs on EDITED + CLIP assets (USD). */
  wanCostUsd: number;
  assets: VideoFrameProjectAssetDto[];
  updatedAt: Date;
  createdAt: Date;
}

function parseSpans(value: Prisma.JsonValue): FrameSpan[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const spans: FrameSpan[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.start !== "number" ||
      typeof row.end !== "number" ||
      typeof row.frameCount !== "number" ||
      !Number.isFinite(row.start) ||
      !Number.isFinite(row.end) ||
      !Number.isFinite(row.frameCount)
    ) {
      continue;
    }
    spans.push({
      id: row.id,
      start: row.start,
      end: row.end,
      frameCount: Math.floor(row.frameCount),
    });
  }
  return spans;
}

function toNumber(value: bigint): number {
  return Number(value);
}

function extensionForVideo(file: File): string {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName && /^\.(mp4|webm|mov|m4v)$/.test(fromName)) {
    return fromName;
  }
  switch (file.type) {
    case "video/webm":
      return ".webm";
    case "video/quicktime":
      return ".mov";
    case "video/x-m4v":
      return ".m4v";
    default:
      return ".mp4";
  }
}

function extensionForAudio(file: File): string {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName && /^\.(mp3|wav|aac|ogg|m4a|webm)$/.test(fromName)) {
    return fromName;
  }
  switch (file.type) {
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "audio/aac":
      return ".aac";
    case "audio/ogg":
      return ".ogg";
    case "audio/mp4":
    case "audio/x-m4a":
    case "audio/m4a":
      return ".m4a";
    case "audio/webm":
      return ".webm";
    default:
      return ".mp3";
  }
}

async function recalculateProjectSizes(projectId: string) {
  const [project, assets] = await Promise.all([
    prisma.videoFrameProject.findUniqueOrThrow({
      where: { id: projectId },
      select: { videoBytes: true },
    }),
    prisma.videoFrameAsset.groupBy({
      by: ["kind"],
      where: { projectId },
      _sum: { bytes: true },
    }),
  ]);

  let framesBytes = BigInt(0);
  let thumbnailsBytes = BigInt(0);
  let editedBytes = BigInt(0);
  let clipsBytes = BigInt(0);
  for (const row of assets) {
    const sum = BigInt(row._sum.bytes ?? 0);
    if (row.kind === "FRAME") {
      framesBytes = sum;
    } else if (row.kind === "THUMBNAIL") {
      thumbnailsBytes = sum;
    } else if (row.kind === "EDITED") {
      editedBytes = sum;
    } else if (
      row.kind === "CLIP" ||
      row.kind === "MERGED" ||
      row.kind === "AUDIO"
    ) {
      clipsBytes += sum;
    }
  }

  const totalBytes =
    project.videoBytes + framesBytes + thumbnailsBytes + editedBytes + clipsBytes;
  return prisma.videoFrameProject.update({
    where: { id: projectId },
    data: { framesBytes, thumbnailsBytes, editedBytes, clipsBytes, totalBytes },
  });
}

function mapDetail(
  project: {
    id: string;
    name: string;
    videoFileName: string | null;
    videoMimeType: string | null;
    videoPath: string | null;
    videoBytes: bigint;
    durationSec: number;
    videoWidth: number | null;
    videoHeight: number | null;
    spansJson: Prisma.JsonValue;
    mergerJson: Prisma.JsonValue;
    framesBytes: bigint;
    thumbnailsBytes: bigint;
    editedBytes: bigint;
    clipsBytes: bigint;
    totalBytes: bigint;
    updatedAt: Date;
    createdAt: Date;
    assets: Array<{
      id: string;
      kind: VideoFrameAssetKind;
      spanId: string | null;
      frameIndex: number | null;
      timeSec: number;
      fileName: string;
      label: string | null;
      path: string;
      bytes: number;
      width: number | null;
      height: number | null;
      costUsd: { toNumber(): number } | number | null;
    }>;
  },
): VideoFrameProjectDetail {
  const clipIds = new Set(
    project.assets
      .filter((asset) => asset.kind === "CLIP")
      .map((asset) => asset.id),
  );
  const audioIds = new Set(
    project.assets
      .filter((asset) => asset.kind === "AUDIO")
      .map((asset) => asset.id),
  );
  const merger =
    sanitizeVideoFrameMergerState(
      parseVideoFrameMergerState(project.mergerJson) ??
        emptyVideoFrameMergerState(),
      clipIds,
      audioIds,
    );

  const assets: VideoFrameProjectAssetDto[] = project.assets.map((asset) => {
    const rawCost = asset.costUsd;
    const costUsd =
      rawCost == null
        ? null
        : typeof rawCost === "number"
          ? rawCost
          : rawCost.toNumber();
    return {
      id: asset.id,
      kind: asset.kind,
      spanId: asset.spanId,
      frameIndex: asset.frameIndex,
      timeSec: asset.timeSec,
      label: asset.label,
      fileName: asset.fileName,
      path: asset.path,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      costUsd:
        costUsd != null && Number.isFinite(costUsd) ? costUsd : null,
    };
  });

  const wanCostUsd = assets.reduce((sum, asset) => {
    if (asset.kind !== "EDITED" && asset.kind !== "CLIP") return sum;
    return sum + (asset.costUsd ?? 0);
  }, 0);

  return {
    id: project.id,
    name: project.name,
    videoFileName: project.videoFileName,
    videoMimeType: project.videoMimeType,
    videoPath: project.videoPath,
    videoBytes: toNumber(project.videoBytes),
    durationSec: project.durationSec,
    videoWidth: project.videoWidth,
    videoHeight: project.videoHeight,
    spans: parseSpans(project.spansJson),
    merger,
    framesBytes: toNumber(project.framesBytes),
    thumbnailsBytes: toNumber(project.thumbnailsBytes),
    editedBytes: toNumber(project.editedBytes),
    clipsBytes: toNumber(project.clipsBytes),
    totalBytes: toNumber(project.totalBytes),
    wanCostUsd,
    assets,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  };
}

export async function listVideoFrameProjects(): Promise<VideoFrameProjectListItem[]> {
  const projects = await prisma.videoFrameProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      assets: {
        where: { kind: "FRAME" },
        select: { id: true },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    videoFileName: project.videoFileName,
    durationSec: project.durationSec,
    spanCount: parseSpans(project.spansJson).length,
    frameCount: project.assets.length,
    videoBytes: toNumber(project.videoBytes),
    framesBytes: toNumber(project.framesBytes),
    thumbnailsBytes: toNumber(project.thumbnailsBytes),
    totalBytes: toNumber(project.totalBytes),
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  }));
}

export async function getVideoFrameProject(id: string): Promise<VideoFrameProjectDetail | null> {
  const project = await prisma.videoFrameProject.findUnique({
    where: { id },
    include: {
      assets: { orderBy: [{ kind: "asc" }, { frameIndex: "asc" }, { timeSec: "asc" }] },
    },
  });
  return project ? mapDetail(project) : null;
}

export async function createVideoFrameProject(input: {
  name: string;
  video: File;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  if (input.video.size <= 0) {
    return { error: "Video file is empty." };
  }
  if (input.video.size > MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES) {
    return {
      error: `Video must be ${Math.round(MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }
  if (
    !ALLOWED_VIDEO_TYPES.has(input.video.type) &&
    !/\.(mp4|webm|mov|m4v)$/i.test(input.video.name)
  ) {
    return { error: "Use an MP4, WebM, or MOV video." };
  }

  const project = await prisma.videoFrameProject.create({
    data: {
      name: input.name,
      spansJson: [],
    },
  });

  const ext = extensionForVideo(input.video);
  const relativeFile = `source${ext}`;
  const dir = videoFrameProjectDir(project.id);
  await mkdir(dir, { recursive: true });

  const absolute = path.join(dir, relativeFile);
  const buffer = Buffer.from(await input.video.arrayBuffer());
  await writeFile(absolute, buffer);

  const videoPath = publicVideoFramePath(project.id, relativeFile);
  const updated = await prisma.videoFrameProject.update({
    where: { id: project.id },
    data: {
      videoFileName: input.video.name,
      videoMimeType: input.video.type || null,
      videoPath,
      videoBytes: BigInt(input.video.size),
      totalBytes: BigInt(input.video.size),
    },
    include: { assets: true },
  });

  return mapDetail(updated);
}

export async function updateVideoFrameProject(input: {
  projectId: string;
  name: string;
  spans: FrameSpan[];
  durationSec?: number;
  videoWidth?: number | null;
  videoHeight?: number | null;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: input.projectId },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  const updated = await prisma.videoFrameProject.update({
    where: { id: input.projectId },
    data: {
      name: input.name,
      spansJson: input.spans as unknown as Prisma.InputJsonValue,
      ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
      ...(input.videoWidth !== undefined ? { videoWidth: input.videoWidth } : {}),
      ...(input.videoHeight !== undefined ? { videoHeight: input.videoHeight } : {}),
    },
    include: {
      assets: { orderBy: [{ kind: "asc" }, { frameIndex: "asc" }, { timeSec: "asc" }] },
    },
  });

  return mapDetail(updated);
}

/**
 * Persist Video merger timeline (segments, trims, playhead, zoom) on the project.
 */
export async function saveVideoFrameMergerState(input: {
  projectId: string;
  state: VideoFrameMergerState;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { error: "Missing project." };
  }

  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: projectId },
    include: {
      assets: {
        where: { kind: { in: ["CLIP", "AUDIO"] } },
        select: { id: true, kind: true },
      },
    },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  const clipIds = new Set(
    existing.assets
      .filter((asset) => asset.kind === "CLIP")
      .map((asset) => asset.id),
  );
  const audioIds = new Set(
    existing.assets
      .filter((asset) => asset.kind === "AUDIO")
      .map((asset) => asset.id),
  );
  const parsed =
    parseVideoFrameMergerState(input.state) ?? emptyVideoFrameMergerState();
  const state = sanitizeVideoFrameMergerState(parsed, clipIds, audioIds);

  const updated = await prisma.videoFrameProject.update({
    where: { id: projectId },
    data: {
      mergerJson: state as unknown as Prisma.InputJsonValue,
    },
    include: {
      assets: { orderBy: [{ kind: "asc" }, { frameIndex: "asc" }, { timeSec: "asc" }] },
    },
  });

  return mapDetail(updated);
}

export async function replaceVideoFrameProjectFrames(input: {
  projectId: string;
  frames: Array<{
    file: File;
    spanId: string;
    frameIndex: number;
    timeSec: number;
    fileName: string;
    width?: number;
    height?: number;
  }>;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: input.projectId },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  const projectDir = videoFrameProjectDir(input.projectId);
  const framesDir = path.join(projectDir, "frames");
  const thumbsDir = path.join(projectDir, "thumbs");

  await rm(framesDir, { recursive: true, force: true });
  await rm(thumbsDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(thumbsDir, { recursive: true });

  // Keep Wan EDITED assets when re-extracting stills from the same video.
  await prisma.videoFrameAsset.deleteMany({
    where: { projectId: input.projectId, kind: { in: ["FRAME", "THUMBNAIL"] } },
  });

  const assetRows: Prisma.VideoFrameAssetCreateManyInput[] = [];

  for (const frame of input.frames) {
    if (frame.file.size <= 0) {
      continue;
    }
    if (frame.file.size > 15 * 1024 * 1024) {
      return { error: `Frame "${frame.fileName}" is too large.` };
    }

    const safeBase =
      frame.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "") ||
      `frame-${frame.frameIndex}.jpg`;
    const unique = `${String(frame.frameIndex).padStart(3, "0")}-${randomBytes(4).toString("hex")}-${safeBase}`;
    const frameAbsolute = path.join(framesDir, unique);
    const buffer = Buffer.from(await frame.file.arrayBuffer());
    await writeFile(frameAbsolute, buffer);

    const framePath = publicVideoFramePath(input.projectId, `frames/${unique}`);
    assetRows.push({
      projectId: input.projectId,
      kind: "FRAME",
      spanId: frame.spanId,
      frameIndex: frame.frameIndex,
      timeSec: frame.timeSec,
      fileName: frame.fileName,
      path: framePath,
      bytes: buffer.byteLength,
      width: frame.width ?? null,
      height: frame.height ?? null,
    });

    try {
      const thumbBuffer = await sharp(buffer, { animated: false })
        .rotate()
        .resize({
          width: THUMB_MAX_WIDTH,
          height: THUMB_MAX_WIDTH,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 72 })
        .toBuffer();
      const thumbName = unique.replace(/\.[^.]+$/, "") + "-thumb.jpg";
      await writeFile(path.join(thumbsDir, thumbName), thumbBuffer);
      assetRows.push({
        projectId: input.projectId,
        kind: "THUMBNAIL",
        spanId: frame.spanId,
        frameIndex: frame.frameIndex,
        timeSec: frame.timeSec,
        fileName: thumbName,
        path: publicVideoFramePath(input.projectId, `thumbs/${thumbName}`),
        bytes: thumbBuffer.byteLength,
        width: null,
        height: null,
      });
    } catch {
      // Thumbnail generation is best-effort; frames still save.
    }
  }

  if (assetRows.length > 0) {
    await prisma.videoFrameAsset.createMany({ data: assetRows });
  }

  await recalculateProjectSizes(input.projectId);
  const detail = await getVideoFrameProject(input.projectId);
  return detail ?? { error: "Project not found after saving frames." };
}

/**
 * Persist a Wan edit result for a planned export time. Replaces any prior EDITED
 * asset at the same timeSec (rounded to 0.1s).
 */
export async function saveVideoFrameEdit(input: {
  projectId: string;
  timeSec: number;
  spanId?: string | null;
  frameIndex?: number | null;
  sourceUrl: string;
  prompt?: string;
  costUsd?: number | null;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  if (!Number.isFinite(input.timeSec) || input.timeSec < 0) {
    return { error: "Invalid frame time." };
  }

  let response: Response;
  try {
    response = await fetch(input.sourceUrl);
  } catch {
    return { error: "Could not download the edited image." };
  }
  if (!response.ok) {
    return { error: `Could not download the edited image (${response.status}).` };
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return { error: "Edited image is empty." };
  }
  if (buffer.byteLength > 25 * 1024 * 1024) {
    return { error: "Edited image is too large to store." };
  }

  const editsDir = path.join(videoFrameProjectDir(input.projectId), "edits");
  await mkdir(editsDir, { recursive: true });

  const timeKey = input.timeSec.toFixed(1).replace(".", "s");
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const fileName = `edit-${timeKey}-${randomBytes(4).toString("hex")}.${ext}`;
  const absolute = path.join(editsDir, fileName);
  await writeFile(absolute, buffer);

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(buffer, { animated: false }).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    // Optional metadata.
  }

  const rounded = Math.round(input.timeSec * 10) / 10;
  const prior = await prisma.videoFrameAsset.findMany({
    where: {
      projectId: input.projectId,
      kind: "EDITED",
    },
  });
  const toRemove = prior.filter(
    (asset) => Math.round(asset.timeSec * 10) / 10 === rounded,
  );
  for (const asset of toRemove) {
    const relative = asset.path.replace(`/uploads/video-frames/${input.projectId}/`, "");
    if (relative && !relative.includes("..")) {
      await rm(path.join(videoFrameProjectDir(input.projectId), relative), {
        force: true,
      });
    }
  }
  if (toRemove.length > 0) {
    await prisma.videoFrameAsset.deleteMany({
      where: { id: { in: toRemove.map((asset) => asset.id) } },
    });
  }

  const costUsd =
    typeof input.costUsd === "number" &&
    Number.isFinite(input.costUsd) &&
    input.costUsd >= 0
      ? input.costUsd
      : null;

  await prisma.videoFrameAsset.create({
    data: {
      projectId: input.projectId,
      kind: "EDITED",
      spanId: input.spanId ?? null,
      frameIndex: input.frameIndex ?? null,
      timeSec: input.timeSec,
      fileName,
      path: publicVideoFramePath(input.projectId, `edits/${fileName}`),
      bytes: buffer.byteLength,
      width,
      height,
      costUsd,
    },
  });

  await recalculateProjectSizes(input.projectId);
  const detail = await getVideoFrameProject(input.projectId);
  return detail ?? { error: "Project not found after saving edit." };
}

/**
 * Remove the Wan EDITED asset(s) at a planned export time (rounded to 0.1s).
 */
export async function deleteVideoFrameEdit(input: {
  projectId: string;
  timeSec: number;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }
  if (!Number.isFinite(input.timeSec) || input.timeSec < 0) {
    return { error: "Invalid frame time." };
  }

  const rounded = Math.round(input.timeSec * 10) / 10;
  const prior = await prisma.videoFrameAsset.findMany({
    where: {
      projectId: input.projectId,
      kind: "EDITED",
    },
  });
  const toRemove = prior.filter(
    (asset) => Math.round(asset.timeSec * 10) / 10 === rounded,
  );
  if (toRemove.length === 0) {
    return { error: "No edited frame at that time." };
  }

  for (const asset of toRemove) {
    const relative = asset.path.replace(
      `/uploads/video-frames/${input.projectId}/`,
      "",
    );
    if (relative && !relative.includes("..")) {
      await rm(path.join(videoFrameProjectDir(input.projectId), relative), {
        force: true,
      });
    }
  }
  await prisma.videoFrameAsset.deleteMany({
    where: { id: { in: toRemove.map((asset) => asset.id) } },
  });

  await recalculateProjectSizes(input.projectId);
  const detail = await getVideoFrameProject(input.projectId);
  return detail ?? { error: "Project not found after deleting edit." };
}

/**
 * Persist a generated clip (Wan / Krea) for a span. Keeps prior clips.
 */
export async function saveVideoFrameClip(input: {
  projectId: string;
  spanId: string;
  timeSec: number;
  sourceUrl: string;
  provider: "wan" | "krea" | "wan-edit";
  prompt?: string;
  costUsd?: number | null;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  const spanId = input.spanId.trim();
  if (!spanId) {
    return { error: "Missing span id." };
  }

  if (!Number.isFinite(input.timeSec) || input.timeSec < 0) {
    return { error: "Invalid clip time." };
  }

  let response: Response;
  try {
    response = await fetch(input.sourceUrl);
  } catch {
    return { error: "Could not download the generated clip." };
  }
  if (!response.ok) {
    return { error: `Could not download the generated clip (${response.status}).` };
  }

  const contentType = response.headers.get("content-type") ?? "video/mp4";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return { error: "Generated clip is empty." };
  }
  if (buffer.byteLength > 200 * 1024 * 1024) {
    return { error: "Generated clip is too large to store." };
  }

  const clipsDir = path.join(videoFrameProjectDir(input.projectId), "clips");
  await mkdir(clipsDir, { recursive: true });

  const ext = contentType.includes("webm")
    ? "webm"
    : contentType.includes("quicktime")
      ? "mov"
      : "mp4";
  const fileName = `clip-${input.provider}-${spanId.slice(0, 8)}-${randomBytes(4).toString("hex")}.${ext}`;
  const absolute = path.join(clipsDir, fileName);
  await writeFile(absolute, buffer);

  const costUsd =
    typeof input.costUsd === "number" &&
    Number.isFinite(input.costUsd) &&
    input.costUsd >= 0
      ? input.costUsd
      : null;

  await prisma.videoFrameAsset.create({
    data: {
      projectId: input.projectId,
      kind: "CLIP",
      spanId,
      frameIndex: null,
      timeSec: input.timeSec,
      fileName,
      path: publicVideoFramePath(input.projectId, `clips/${fileName}`),
      bytes: buffer.byteLength,
      width: null,
      height: null,
      costUsd,
    },
  });

  await recalculateProjectSizes(input.projectId);
  const detail = await getVideoFrameProject(input.projectId);
  return detail ?? { error: "Project not found after saving clip." };
}

/**
 * Persist an admin-uploaded local video as a CLIP asset (for the merger).
 * Not tied to a span (`spanId` null).
 */
export async function uploadVideoFrameLocalClip(input: {
  projectId: string;
  video: File;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { error: "Missing project." };
  }

  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  if (input.video.size <= 0) {
    return { error: "Video file is empty." };
  }
  if (input.video.size > MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES) {
    return {
      error: `Video must be ${Math.round(MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }
  if (
    !ALLOWED_VIDEO_TYPES.has(input.video.type) &&
    !/\.(mp4|webm|mov|m4v)$/i.test(input.video.name)
  ) {
    return { error: "Use an MP4, WebM, or MOV video." };
  }

  const clipsDir = path.join(videoFrameProjectDir(projectId), "clips");
  await mkdir(clipsDir, { recursive: true });

  const ext = extensionForVideo(input.video).replace(/^\./, "") || "mp4";
  const fileName = `clip-local-${randomBytes(4).toString("hex")}.${ext}`;
  const absolute = path.join(clipsDir, fileName);
  const buffer = Buffer.from(await input.video.arrayBuffer());
  await writeFile(absolute, buffer);

  await prisma.videoFrameAsset.create({
    data: {
      projectId,
      kind: "CLIP",
      spanId: null,
      frameIndex: null,
      timeSec: 0,
      fileName,
      path: publicVideoFramePath(projectId, `clips/${fileName}`),
      bytes: buffer.byteLength,
      width: null,
      height: null,
    },
  });

  await recalculateProjectSizes(projectId);
  const detail = await getVideoFrameProject(projectId);
  return detail ?? { error: "Project not found after uploading clip." };
}

/**
 * Persist an admin-uploaded audio file as an AUDIO asset (merger soundtrack).
 */
export async function uploadVideoFrameLocalAudio(input: {
  projectId: string;
  audio: File;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { error: "Missing project." };
  }

  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  if (input.audio.size <= 0) {
    return { error: "Audio file is empty." };
  }
  if (input.audio.size > MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES) {
    return {
      error: `Audio must be ${Math.round(MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }
  if (
    !ALLOWED_AUDIO_TYPES.has(input.audio.type) &&
    !input.audio.type.startsWith("audio/") &&
    !/\.(mp3|wav|aac|ogg|m4a|webm)$/i.test(input.audio.name)
  ) {
    return { error: "Use an MP3, WAV, AAC, OGG, or M4A audio file." };
  }

  const audioDir = path.join(videoFrameProjectDir(projectId), "audio");
  await mkdir(audioDir, { recursive: true });

  const ext = extensionForAudio(input.audio).replace(/^\./, "") || "mp3";
  const fileName = `audio-local-${randomBytes(4).toString("hex")}.${ext}`;
  const absolute = path.join(audioDir, fileName);
  const buffer = Buffer.from(await input.audio.arrayBuffer());
  await writeFile(absolute, buffer);

  await prisma.videoFrameAsset.create({
    data: {
      projectId,
      kind: "AUDIO",
      spanId: null,
      frameIndex: null,
      timeSec: 0,
      fileName,
      path: publicVideoFramePath(projectId, `audio/${fileName}`),
      bytes: buffer.byteLength,
      width: null,
      height: null,
    },
  });

  await recalculateProjectSizes(projectId);
  const detail = await getVideoFrameProject(projectId);
  return detail ?? { error: "Project not found after uploading audio." };
}

function absoluteFromPublicUpload(publicPath: string): string | null {
  if (!isLocalVideoFrameUpload(publicPath)) return null;
  const relative = publicPath.slice(LOCAL_VIDEO_FRAME_UPLOAD_PREFIX.length);
  if (!relative || relative.includes("..")) return null;
  return path.join(videoFrameProjectsUploadsDir(), relative);
}

function nextMergeVersionLabel(existingLabels: Array<string | null>): string {
  let maxMinor = -1;
  for (const label of existingLabels) {
    if (!label) continue;
    const match = /^1\.(\d+)$/.exec(label.trim());
    if (!match) continue;
    const minor = Number(match[1]);
    if (Number.isFinite(minor) && minor > maxMinor) {
      maxMinor = minor;
    }
  }
  return `1.${maxMinor + 1}`;
}

export interface MergeVideoFrameSegmentInput {
  assetId: string;
  trimStartSec: number;
  /** When omitted, keep through the end of the source clip. */
  trimEndSec?: number;
}

export interface MergeVideoFrameAudioTrackInput {
  assetId: string;
  trimStartSec: number;
  trimEndSec: number;
  startAtSec: number;
  volume?: number;
}

/**
 * Concatenate ordered CLIP assets into a versioned MERGED asset (1.0, 1.1, …).
 * Optional per-segment trim ranges are applied during ffmpeg normalize.
 * Optional AUDIO soundtracks are trimmed, placed on composition time, and mixed in.
 */
export async function mergeVideoFrameClips(input: {
  projectId: string;
  assetIds?: string[];
  segments?: MergeVideoFrameSegmentInput[];
  audioTracks?: MergeVideoFrameAudioTrackInput[];
  /** When true, strip clip audio (soundtrack still mixed when present). */
  stripAudio?: boolean;
  /** 9:16 export size (720p / 1080p / 2K). */
  exportQuality?: MergeExportQuality;
}): Promise<VideoFrameProjectDetail | { error: string }> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { error: "Missing project." };
  }

  const segments: MergeVideoFrameSegmentInput[] =
    input.segments?.map((segment) => ({
      assetId: segment.assetId.trim(),
      trimStartSec: segment.trimStartSec,
      trimEndSec: segment.trimEndSec,
    })) ??
    (input.assetIds ?? []).map((assetId) => ({
      assetId: assetId.trim(),
      trimStartSec: 0,
    }));

  const assetIds = segments.map((segment) => segment.assetId).filter(Boolean);
  if (assetIds.length < 2) {
    return { error: "Pick at least two clips to merge." };
  }
  if (new Set(assetIds).size !== assetIds.length) {
    return { error: "Duplicate clips are not allowed in a merge." };
  }

  for (const segment of segments) {
    if (!Number.isFinite(segment.trimStartSec) || segment.trimStartSec < 0) {
      return { error: "Invalid trim start on one of the clips." };
    }
    if (
      segment.trimEndSec != null &&
      (!Number.isFinite(segment.trimEndSec) ||
        segment.trimEndSec <= segment.trimStartSec + 0.04)
    ) {
      return { error: "Invalid trim range on one of the clips." };
    }
  }

  const audioTracks: MergeVideoFrameAudioTrackInput[] = (
    input.audioTracks ?? []
  ).map((track) => ({
    assetId: track.assetId.trim(),
    trimStartSec: track.trimStartSec,
    trimEndSec: track.trimEndSec,
    startAtSec: track.startAtSec,
    volume: track.volume,
  }));

  for (const track of audioTracks) {
    if (!track.assetId) {
      return { error: "Invalid soundtrack asset." };
    }
    if (
      !Number.isFinite(track.trimStartSec) ||
      track.trimStartSec < 0 ||
      !Number.isFinite(track.trimEndSec) ||
      track.trimEndSec <= track.trimStartSec + 0.04 ||
      !Number.isFinite(track.startAtSec) ||
      track.startAtSec < 0
    ) {
      return { error: "Invalid trim or placement on a soundtrack." };
    }
  }

  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  const clips = await prisma.videoFrameAsset.findMany({
    where: {
      projectId,
      kind: "CLIP",
      id: { in: assetIds },
    },
    select: { id: true, path: true, fileName: true },
  });
  if (clips.length !== assetIds.length) {
    return { error: "One or more selected clips were not found." };
  }

  const audioAssetIds = audioTracks.map((track) => track.assetId);
  const audioAssets =
    audioAssetIds.length > 0
      ? await prisma.videoFrameAsset.findMany({
          where: {
            projectId,
            kind: "AUDIO",
            id: { in: audioAssetIds },
          },
          select: { id: true, path: true, fileName: true },
        })
      : [];
  if (audioAssets.length !== new Set(audioAssetIds).size) {
    return { error: "One or more soundtracks were not found." };
  }

  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const audioById = new Map(audioAssets.map((asset) => [asset.id, asset]));
  const concatSegments: Array<{
    absoluteSourcePath: string;
    trimStartSec?: number;
    trimEndSec?: number;
  }> = [];
  let compositionDurationSec = 0;
  for (const segment of segments) {
    const clip = byId.get(segment.assetId);
    if (!clip) {
      return { error: "One or more selected clips were not found." };
    }
    const absolute = absoluteFromPublicUpload(clip.path);
    if (!absolute) {
      return { error: `Invalid path for clip ${clip.fileName}.` };
    }
    concatSegments.push({
      absoluteSourcePath: absolute,
      trimStartSec: segment.trimStartSec,
      trimEndSec: segment.trimEndSec,
    });
    if (segment.trimEndSec != null) {
      compositionDurationSec += Math.max(
        0,
        segment.trimEndSec - segment.trimStartSec,
      );
    }
  }

  const soundtrackMix: SoundtrackMixInput[] = [];
  for (const track of audioTracks) {
    const asset = audioById.get(track.assetId);
    if (!asset) {
      return { error: "One or more soundtracks were not found." };
    }
    const absolute = absoluteFromPublicUpload(asset.path);
    if (!absolute) {
      return { error: `Invalid path for audio ${asset.fileName}.` };
    }
    soundtrackMix.push({
      absoluteSourcePath: absolute,
      trimStartSec: track.trimStartSec,
      trimEndSec: track.trimEndSec,
      startAtSec: track.startAtSec,
      volume: track.volume,
    });
  }

  const priorMerged = await prisma.videoFrameAsset.findMany({
    where: { projectId, kind: "MERGED" },
    select: { label: true },
  });
  const label = nextMergeVersionLabel(priorMerged.map((row) => row.label));

  const exportQuality = parseMergeExportQuality(
    input.exportQuality ?? DEFAULT_MERGE_EXPORT_QUALITY,
  );

  let merged: { bytes: Buffer; contentType: string; filename: string };
  try {
    merged = await concatVideoSegments({
      segments: concatSegments,
      stripAudio: input.stripAudio === true,
      quality: exportQuality,
      soundtracks: soundtrackMix,
      compositionDurationSec:
        compositionDurationSec > 0 ? compositionDurationSec : undefined,
    });
  } catch (error) {
    if (error instanceof VideoCutError) {
      return { error: error.message };
    }
    return {
      error:
        error instanceof Error ? error.message : "Failed to merge clips.",
    };
  }

  if (merged.bytes.byteLength > 400 * 1024 * 1024) {
    return { error: "Merged video is too large to store." };
  }

  const mergesDir = path.join(videoFrameProjectDir(projectId), "merges");
  await mkdir(mergesDir, { recursive: true });

  const safeLabel = label.replace(/[^0-9.]/g, "");
  const fileName = `merge-v${safeLabel}-${randomBytes(4).toString("hex")}.mp4`;
  const absolute = path.join(mergesDir, fileName);
  await writeFile(absolute, merged.bytes);

  await prisma.videoFrameAsset.create({
    data: {
      projectId,
      kind: "MERGED",
      spanId: null,
      frameIndex: null,
      timeSec: 0,
      fileName,
      label,
      path: publicVideoFramePath(projectId, `merges/${fileName}`),
      bytes: merged.bytes.byteLength,
      width: null,
      height: null,
    },
  });

  await recalculateProjectSizes(projectId);
  const detail = await getVideoFrameProject(projectId);
  return detail ?? { error: "Project not found after merging clips." };
}

export async function deleteVideoFrameProject(
  projectId: string,
): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.videoFrameProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "Project not found." };
  }

  await prisma.videoFrameProject.delete({ where: { id: projectId } });
  await rm(videoFrameProjectDir(projectId), { recursive: true, force: true });
  return { ok: true };
}
