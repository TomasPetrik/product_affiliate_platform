import path from "node:path";

export const LOCAL_VIDEO_FRAME_UPLOAD_PREFIX = "/uploads/video-frames/";
export const MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES = 200 * 1024 * 1024;
/** Soundtrack uploads for the Video merger (mp3/wav/aac/ogg/m4a). */
export const MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES = 80 * 1024 * 1024;

/** On-disk root for video-frame project media. */
export function videoFrameProjectsUploadsDir(): string {
  return path.join(process.cwd(), "storage", "uploads", "video-frames");
}

export function videoFrameProjectDir(projectId: string): string {
  return path.join(videoFrameProjectsUploadsDir(), projectId);
}

export function isLocalVideoFrameUpload(url: string): boolean {
  return (
    url.startsWith(LOCAL_VIDEO_FRAME_UPLOAD_PREFIX) &&
    !url.includes("..") &&
    !url.includes("\\")
  );
}

export function publicVideoFramePath(projectId: string, relativeFile: string): string {
  const safe = relativeFile.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${LOCAL_VIDEO_FRAME_UPLOAD_PREFIX}${projectId}/${safe}`;
}

export function formatByteSize(bytes: number | bigint): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value < 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"] as const;
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}
