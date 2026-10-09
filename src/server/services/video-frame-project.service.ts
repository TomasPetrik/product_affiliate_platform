import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { Prisma } from "@/generated/prisma/client";
import type { VideoFrameAssetKind } from "@/generated/prisma/enums";
import {
  MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES,
  publicVideoFramePath,
  videoFrameProjectDir,
} from "@/lib/video-frame-project-paths";
import type { FrameSpan } from "@/lib/video-frames";
import { prisma } from "@/lib/prisma";

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
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
  path: string;
  bytes: number;
  width: number | null;
  height: number | null;
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
  framesBytes: number;
  thumbnailsBytes: number;
  totalBytes: number;
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
  for (const row of assets) {
    const sum = BigInt(row._sum.bytes ?? 0);
    if (row.kind === "FRAME") {
      framesBytes = sum;
    } else if (row.kind === "THUMBNAIL") {
      thumbnailsBytes = sum;
    }
  }

  const totalBytes = project.videoBytes + framesBytes + thumbnailsBytes;
  return prisma.videoFrameProject.update({
    where: { id: projectId },
    data: { framesBytes, thumbnailsBytes, totalBytes },
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
    framesBytes: bigint;
    thumbnailsBytes: bigint;
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
      path: string;
      bytes: number;
      width: number | null;
      height: number | null;
    }>;
  },
): VideoFrameProjectDetail {
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
    framesBytes: toNumber(project.framesBytes),
    thumbnailsBytes: toNumber(project.thumbnailsBytes),
    totalBytes: toNumber(project.totalBytes),
    assets: project.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      spanId: asset.spanId,
      frameIndex: asset.frameIndex,
      timeSec: asset.timeSec,
      fileName: asset.fileName,
      path: asset.path,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
    })),
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

  await prisma.videoFrameAsset.deleteMany({ where: { projectId: input.projectId } });

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
