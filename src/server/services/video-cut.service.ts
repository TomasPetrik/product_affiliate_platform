import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  DEFAULT_MERGE_EXPORT_QUALITY,
  mergeExportSize,
  parseMergeExportQuality,
  type MergeExportQuality,
} from "@/lib/video-frame-merge-quality";
import { WAN_VIDEO_EDIT_INPUT_MAX_SEC } from "@/lib/wan-video-edit";

export class VideoCutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoCutError";
  }
}

const MERGE_MAX_CLIPS = 40;

function normalizeVfForQuality(quality: MergeExportQuality): string {
  const { width, height } = mergeExportSize(quality);
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(
        new VideoCutError(
          error.message.includes("ENOENT")
            ? "ffmpeg is not installed on this server."
            : `ffmpeg failed to start: ${error.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const hint = stderr.trim().split("\n").slice(-4).join(" ").slice(0, 400);
      reject(
        new VideoCutError(
          hint
            ? `ffmpeg failed (${code}): ${hint}`
            : `ffmpeg failed with exit code ${code}.`,
        ),
      );
    });
  });
}

export interface ConcatSegmentInput {
  absoluteSourcePath: string;
  /** Inclusive start of kept range (seconds). */
  trimStartSec?: number;
  /** Exclusive-ish end of kept range (seconds). */
  trimEndSec?: number;
}

function trimArgs(segment: ConcatSegmentInput): string[] {
  const start =
    Number.isFinite(segment.trimStartSec) && (segment.trimStartSec ?? 0) > 0
      ? Math.max(0, segment.trimStartSec!)
      : null;
  const end =
    Number.isFinite(segment.trimEndSec) && (segment.trimEndSec ?? 0) > 0
      ? Math.max(0, segment.trimEndSec!)
      : null;
  if (start == null && end == null) {
    return [];
  }
  const args: string[] = [];
  if (start != null) {
    args.push("-ss", start.toFixed(3));
  }
  if (end != null && (start == null || end > start + 0.05)) {
    args.push("-to", end.toFixed(3));
  }
  return args;
}

async function normalizeClipForConcat(
  segment: ConcatSegmentInput,
  outPath: string,
  options?: { stripAudio?: boolean; quality?: MergeExportQuality },
): Promise<void> {
  const trim = trimArgs(segment);
  const stripAudio = options?.stripAudio === true;
  const quality = parseMergeExportQuality(
    options?.quality ?? DEFAULT_MERGE_EXPORT_QUALITY,
  );
  const normalizeVf = normalizeVfForQuality(quality);

  if (stripAudio) {
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      segment.absoluteSourcePath,
      ...trim,
      "-vf",
      normalizeVf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outPath,
    ]);
    return;
  }

  const baseArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    segment.absoluteSourcePath,
    ...trim,
    "-vf",
    normalizeVf,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    "-avoid_negative_ts",
    "make_zero",
    outPath,
  ];

  try {
    await runFfmpeg(baseArgs);
  } catch {
    // Clips without an audio stream fail AAC encode — pad with silence.
    // Put trim after both inputs so -ss/-to apply to the output, not lavfi.
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      segment.absoluteSourcePath,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      ...trim,
      "-vf",
      normalizeVf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-shortest",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outPath,
    ]);
  }
}

/**
 * Cut `[startSec, endSec]` from a local video file into an H.264 MP4.
 * WaveSpeed video-edit accepts up to 15s of input.
 */
export async function cutVideoSegment(input: {
  absoluteSourcePath: string;
  startSec: number;
  endSec: number;
}): Promise<{ bytes: Buffer; contentType: string; filename: string }> {
  if (!Number.isFinite(input.startSec) || !Number.isFinite(input.endSec)) {
    throw new VideoCutError("Invalid cut range.");
  }

  const start = Math.max(0, input.startSec);
  const end = Math.max(start + 0.05, input.endSec);
  const length = end - start;
  if (length > WAN_VIDEO_EDIT_INPUT_MAX_SEC + 0.05) {
    throw new VideoCutError(
      `Cut is ${length.toFixed(1)}s — Wan video edit accepts at most ${WAN_VIDEO_EDIT_INPUT_MAX_SEC}s of input.`,
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "radarcut-cut-"));
  const outPath = path.join(dir, "cut.mp4");

  try {
    // Seek after -i for frame-accurate cuts on short spans.
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input.absoluteSourcePath,
      "-ss",
      start.toFixed(3),
      "-to",
      end.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      outPath,
    ]);

    const bytes = await readFile(outPath);
    if (bytes.byteLength <= 0) {
      throw new VideoCutError("Cut produced an empty file.");
    }

    return {
      bytes,
      contentType: "video/mp4",
      filename: `span-${start.toFixed(1)}-${end.toFixed(1)}.mp4`,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Concatenate local video files into a single H.264 MP4.
 * Each input is optionally trimmed, then normalized to 9:16 at the chosen
 * quality (720p / 1080p / 2K), 30fps, AAC — or no audio when stripAudio is set.
 */
export async function concatVideoSegments(input: {
  absoluteSourcePaths?: string[];
  segments?: ConcatSegmentInput[];
  /** When true, output has no audio track. */
  stripAudio?: boolean;
  /** 9:16 output size. Defaults to 1080p. */
  quality?: MergeExportQuality;
}): Promise<{ bytes: Buffer; contentType: string; filename: string }> {
  const segments: ConcatSegmentInput[] =
    input.segments?.filter((s) => s.absoluteSourcePath.trim().length > 0) ??
    (input.absoluteSourcePaths ?? [])
      .filter((p) => p.trim().length > 0)
      .map((absoluteSourcePath) => ({ absoluteSourcePath }));
  const stripAudio = input.stripAudio === true;
  const quality = parseMergeExportQuality(
    input.quality ?? DEFAULT_MERGE_EXPORT_QUALITY,
  );

  if (segments.length < 2) {
    throw new VideoCutError("Need at least two clips to merge.");
  }
  if (segments.length > MERGE_MAX_CLIPS) {
    throw new VideoCutError(`Too many clips to merge (max ${MERGE_MAX_CLIPS}).`);
  }

  for (const segment of segments) {
    const start = segment.trimStartSec ?? 0;
    const end = segment.trimEndSec;
    if (end != null && end <= start + 0.04) {
      throw new VideoCutError("A trimmed clip is too short to merge.");
    }
  }

  const dir = await mkdtemp(path.join(tmpdir(), "radarcut-merge-"));
  const outPath = path.join(dir, "merged.mp4");
  const listPath = path.join(dir, "concat.txt");

  try {
    const partPaths: string[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      const partPath = path.join(dir, `part-${String(i).padStart(3, "0")}.mp4`);
      await normalizeClipForConcat(segments[i]!, partPath, {
        stripAudio,
        quality,
      });
      partPaths.push(partPath);
    }

    const listBody = partPaths
      .map((part) => `file '${part.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, listBody, "utf8");

    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outPath,
    ]);

    const bytes = await readFile(outPath);
    if (bytes.byteLength <= 0) {
      throw new VideoCutError("Merge produced an empty file.");
    }

    return {
      bytes,
      contentType: "video/mp4",
      filename: `merged-${segments.length}-clips.mp4`,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
