import type { Prisma } from "@/generated/prisma/client";

/** One uploaded source video inside a Video creator project. */
export interface ProjectSourceVideo {
  id: string;
  fileName: string;
  mimeType: string | null;
  /** Public path under /uploads/video-frames/{projectId}/… */
  path: string;
  bytes: number;
  durationSec: number;
  width: number | null;
  height: number | null;
}

export const MAX_VIDEO_FRAME_PROJECT_VIDEOS = 12;

export function newProjectSourceVideoId(): string {
  return `vid-${crypto.randomUUID()}`;
}

export function parseProjectSourceVideos(value: Prisma.JsonValue): ProjectSourceVideo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const videos: ProjectSourceVideo[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      typeof row.fileName !== "string" ||
      !row.fileName.trim() ||
      typeof row.path !== "string" ||
      !row.path.trim() ||
      typeof row.bytes !== "number" ||
      !Number.isFinite(row.bytes)
    ) {
      continue;
    }
    const durationSec =
      typeof row.durationSec === "number" && Number.isFinite(row.durationSec)
        ? Math.max(0, row.durationSec)
        : 0;
    const width =
      typeof row.width === "number" && Number.isInteger(row.width) && row.width > 0
        ? row.width
        : null;
    const height =
      typeof row.height === "number" && Number.isInteger(row.height) && row.height > 0
        ? row.height
        : null;
    const mimeType =
      typeof row.mimeType === "string" && row.mimeType.trim()
        ? row.mimeType.trim()
        : null;
    videos.push({
      id: row.id.trim(),
      fileName: row.fileName.trim().slice(0, 240),
      mimeType,
      path: row.path.trim(),
      bytes: Math.max(0, Math.floor(row.bytes)),
      durationSec,
      width,
      height,
    });
  }
  return videos;
}

/** Build videos list from legacy single-video columns when videosJson is empty. */
export function legacyProjectSourceVideos(input: {
  videoPath: string | null;
  videoFileName: string | null;
  videoMimeType: string | null;
  videoBytes: number;
  durationSec: number;
  videoWidth: number | null;
  videoHeight: number | null;
}): ProjectSourceVideo[] {
  if (!input.videoPath) {
    return [];
  }
  return [
    {
      id: "legacy-source",
      fileName: input.videoFileName?.trim() || "source.mp4",
      mimeType: input.videoMimeType,
      path: input.videoPath,
      bytes: Math.max(0, Math.floor(input.videoBytes)),
      durationSec:
        Number.isFinite(input.durationSec) && input.durationSec > 0
          ? input.durationSec
          : 0,
      width: input.videoWidth,
      height: input.videoHeight,
    },
  ];
}

export function resolveProjectVideos(input: {
  videosJson: Prisma.JsonValue;
  videoPath: string | null;
  videoFileName: string | null;
  videoMimeType: string | null;
  videoBytes: number;
  durationSec: number;
  videoWidth: number | null;
  videoHeight: number | null;
}): ProjectSourceVideo[] {
  const parsed = parseProjectSourceVideos(input.videosJson);
  if (parsed.length > 0) {
    return parsed;
  }
  return legacyProjectSourceVideos(input);
}

export function findProjectSourceVideo(
  videos: ProjectSourceVideo[],
  videoId: string | null | undefined,
): ProjectSourceVideo | null {
  if (videos.length === 0) {
    return null;
  }
  if (videoId) {
    const match = videos.find((video) => video.id === videoId);
    if (match) {
      return match;
    }
  }
  return videos[0] ?? null;
}

export function totalProjectVideoBytes(videos: ProjectSourceVideo[]): number {
  return videos.reduce((sum, video) => sum + Math.max(0, video.bytes), 0);
}

/** Sync denormalized single-video columns from the videos list (first = primary). */
export function primaryVideoColumns(videos: ProjectSourceVideo[]): {
  videoFileName: string | null;
  videoMimeType: string | null;
  videoPath: string | null;
  videoBytes: bigint;
  durationSec: number;
  videoWidth: number | null;
  videoHeight: number | null;
} {
  const primary = videos[0] ?? null;
  return {
    videoFileName: primary?.fileName ?? null,
    videoMimeType: primary?.mimeType ?? null,
    videoPath: primary?.path ?? null,
    videoBytes: BigInt(totalProjectVideoBytes(videos)),
    durationSec: primary?.durationSec ?? 0,
    videoWidth: primary?.width ?? null,
    videoHeight: primary?.height ?? null,
  };
}
