import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { WAN_VIDEO_EDIT_INPUT_MAX_SEC } from "@/lib/wan-video-edit";

export class VideoCutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoCutError";
  }
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
