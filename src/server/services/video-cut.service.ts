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
  /** Silence this clip's audio (keeps an AAC stream so concat + soundtrack mix stay aligned). */
  muted?: boolean;
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

async function normalizeClipWithSilentAudio(
  segment: ConcatSegmentInput,
  outPath: string,
  normalizeVf: string,
  trim: string[],
): Promise<void> {
  // Silent AAC keeps concat stream layout consistent so soundtrack can amix.
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

async function normalizeClipForConcat(
  segment: ConcatSegmentInput,
  outPath: string,
  options?: {
    stripAudio?: boolean;
    quality?: MergeExportQuality;
    /** Prefer silent AAC over -an so soundtrack can overlay muted clips. */
    keepSilentAudio?: boolean;
  },
): Promise<void> {
  const trim = trimArgs(segment);
  const stripAudio =
    options?.stripAudio === true || segment.muted === true;
  const quality = parseMergeExportQuality(
    options?.quality ?? DEFAULT_MERGE_EXPORT_QUALITY,
  );
  const normalizeVf = normalizeVfForQuality(quality);
  const keepSilentAudio = options?.keepSilentAudio === true;

  if (stripAudio && !keepSilentAudio) {
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

  if (stripAudio && keepSilentAudio) {
    await normalizeClipWithSilentAudio(segment, outPath, normalizeVf, trim);
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
    await normalizeClipWithSilentAudio(segment, outPath, normalizeVf, trim);
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

export interface SoundtrackMixInput {
  absoluteSourcePath: string;
  trimStartSec: number;
  trimEndSec: number;
  /** Composition time (seconds) where the trimmed audio begins. */
  startAtSec: number;
  /** Linear gain 0–1. */
  volume?: number;
}

const MERGE_MAX_SOUNDTRACKS = 8;

function soundtrackFilterLabel(index: number): string {
  return `bg${index}`;
}

/**
 * Mix one or more trimmed/offset soundtracks onto a concatenated video.
 * When `videoHasAudio` is false, soundtracks become the sole audio stream.
 */
async function mixSoundtracksOntoVideo(input: {
  videoPath: string;
  outPath: string;
  videoDurationSec: number;
  videoHasAudio: boolean;
  soundtracks: SoundtrackMixInput[];
}): Promise<void> {
  const tracks = input.soundtracks.filter(
    (track) => track.absoluteSourcePath.trim().length > 0,
  );
  if (tracks.length === 0) {
    throw new VideoCutError("No soundtrack paths provided.");
  }
  if (tracks.length > MERGE_MAX_SOUNDTRACKS) {
    throw new VideoCutError(
      `Too many soundtracks to mix (max ${MERGE_MAX_SOUNDTRACKS}).`,
    );
  }

  const videoDur = Math.max(0.1, input.videoDurationSec);
  const filterParts: string[] = [];
  const mixInputs: string[] = [];

  if (input.videoHasAudio) {
    filterParts.push(
      `[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100[va]`,
    );
    mixInputs.push("[va]");
  }

  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i]!;
    const trimStart = Math.max(0, track.trimStartSec);
    const trimEnd = Math.max(trimStart + 0.05, track.trimEndSec);
    const delayMs = Math.max(0, Math.round(track.startAtSec * 1000));
    const volume = Math.min(
      1,
      Math.max(0, Number.isFinite(track.volume) ? track.volume! : 1),
    );
    const label = soundtrackFilterLabel(i);
    // Input index is i+1 because 0 is the video.
    filterParts.push(
      `[${i + 1}:a]atrim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume.toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100,adelay=${delayMs}|${delayMs},apad,atrim=0:${videoDur.toFixed(3)},asetpts=PTS-STARTPTS[${label}]`,
    );
    mixInputs.push(`[${label}]`);
  }

  const filterComplex =
    mixInputs.length === 1
      ? `${filterParts.join(";")}`
      : `${filterParts.join(";")};${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0[aout]`;

  const mapAudio = mixInputs.length === 1 ? mixInputs[0]! : "[aout]";

  const args: string[] = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input.videoPath,
  ];
  for (const track of tracks) {
    args.push("-i", track.absoluteSourcePath);
  }
  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    "0:v:0",
    "-map",
    mapAudio,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    "-t",
    videoDur.toFixed(3),
    input.outPath,
  );

  await runFfmpeg(args);
}

function keptSegmentDurationSec(segment: ConcatSegmentInput): number {
  const start = Math.max(0, segment.trimStartSec ?? 0);
  const end = segment.trimEndSec;
  if (end != null && Number.isFinite(end) && end > start) {
    return end - start;
  }
  return 0;
}

function soundtrackEndSec(track: SoundtrackMixInput): number {
  const kept = Math.max(0, track.trimEndSec - track.trimStartSec);
  return Math.max(0, track.startAtSec) + kept;
}

/** Black 9:16 pad (optional silent AAC) matching merge normalize settings. */
async function generateBlackPadClip(input: {
  outPath: string;
  durationSec: number;
  quality: MergeExportQuality;
  withSilentAudio: boolean;
}): Promise<void> {
  const duration = Math.max(0.05, input.durationSec);
  const { width, height } = mergeExportSize(input.quality);
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${width}x${height}:r=30:d=${duration.toFixed(3)}`,
  ];
  if (input.withSilentAudio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      `anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration.toFixed(3)}`,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-ar",
      "44100",
    );
  } else {
    args.push("-an");
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-t",
    duration.toFixed(3),
    "-movflags",
    "+faststart",
    input.outPath,
  );
  await runFfmpeg(args);
}

/**
 * Concatenate local video files into a single H.264 MP4.
 * Each input is optionally trimmed, then normalized to 9:16 at the chosen
 * quality (720p / 1080p / 2K), 30fps, AAC — or no audio when stripAudio is set.
 * Optional soundtracks are trimmed, delayed to composition time, and mixed in.
 */
export async function concatVideoSegments(input: {
  absoluteSourcePaths?: string[];
  segments?: ConcatSegmentInput[];
  /** When true, clip audio is stripped (soundtracks may still be mixed in). */
  stripAudio?: boolean;
  /** 9:16 output size. Defaults to 1080p. */
  quality?: MergeExportQuality;
  soundtracks?: SoundtrackMixInput[];
  /** Total kept composition duration (seconds). Used when mixing soundtracks. */
  compositionDurationSec?: number;
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
  const soundtracks = (input.soundtracks ?? []).filter(
    (track) => track.absoluteSourcePath.trim().length > 0,
  );
  const anyClipMuted = segments.some((segment) => segment.muted === true);
  // Keep silent AAC on muted clips (and when mixing a soundtrack) so streams match
  // for concat and soundtrack can overlay unmuted clip audio.
  const keepSilentAudio =
    soundtracks.length > 0 || (anyClipMuted && !stripAudio);

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

  for (const track of soundtracks) {
    if (track.trimEndSec <= track.trimStartSec + 0.04) {
      throw new VideoCutError("A trimmed soundtrack is too short to merge.");
    }
  }

  const dir = await mkdtemp(path.join(tmpdir(), "radarcut-merge-"));
  const concatPath = path.join(dir, "concat.mp4");
  const outPath = path.join(dir, "merged.mp4");
  const listPath = path.join(dir, "concat.txt");

  try {
    const partPaths: string[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      const partPath = path.join(dir, `part-${String(i).padStart(3, "0")}.mp4`);
      const segment = segments[i]!;
      await normalizeClipForConcat(segment, partPath, {
        stripAudio: stripAudio || segment.muted === true,
        keepSilentAudio,
        quality,
      });
      partPaths.push(partPath);
    }

    const videoKeptSec = segments.reduce(
      (sum, segment) => sum + keptSegmentDurationSec(segment),
      0,
    );
    const audioExtentSec = soundtracks.reduce(
      (max, track) => Math.max(max, soundtrackEndSec(track)),
      0,
    );
    const compositionDurationSec = Math.max(
      videoKeptSec,
      audioExtentSec,
      input.compositionDurationSec != null &&
        Number.isFinite(input.compositionDurationSec) &&
        input.compositionDurationSec > 0
        ? input.compositionDurationSec
        : 0,
    );
    const blackPadSec = Math.max(0, compositionDurationSec - videoKeptSec);

    // Soundtrack past the last clip → append black video (silent AAC when needed).
    if (blackPadSec > 0.04) {
      const padPath = path.join(dir, "black-pad.mp4");
      await generateBlackPadClip({
        outPath: padPath,
        durationSec: blackPadSec,
        quality,
        withSilentAudio: !stripAudio || keepSilentAudio,
      });
      partPaths.push(padPath);
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
      concatPath,
    ]);

    let finalPath = concatPath;
    if (soundtracks.length > 0) {
      if (!(compositionDurationSec > 0)) {
        throw new VideoCutError(
          "Could not determine composition duration for soundtrack mix.",
        );
      }
      await mixSoundtracksOntoVideo({
        videoPath: concatPath,
        outPath,
        videoDurationSec: compositionDurationSec,
        // Silent AAC is still an audio stream — amix overlays soundtrack on it.
        videoHasAudio: !stripAudio || keepSilentAudio,
        soundtracks,
      });
      finalPath = outPath;
    }

    const bytes = await readFile(finalPath);
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
