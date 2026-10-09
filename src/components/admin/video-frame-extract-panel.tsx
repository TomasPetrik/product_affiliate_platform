"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  Check,
  Clapperboard,
  CloudUpload,
  Download,
  Film,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VideoFrameKreaClipDialog,
  type SpanClipFrameCandidate,
} from "@/components/admin/video-frame-krea-clip-dialog";
import {
  VideoFrameWanClipDialog,
  type WanClipJob,
} from "@/components/admin/video-frame-wan-clip-dialog";
import {
  VideoFrameWanEditDialog,
  type WanFrameJob,
} from "@/components/admin/video-frame-wan-edit-dialog";
import {
  clampSpan,
  createDefaultSpans,
  createZipBlob,
  formatVideoTime,
  newSpanId,
  previewTimeKey,
  timestampsForSpan,
  totalFrameCount,
  uniquePreviewTimes,
  type ExtractedFrame,
  type FrameSpan,
} from "@/lib/video-frames";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WAN_SIZE,
  estimateWanProgressPercent,
  isWanCompleted,
  isWanTerminalFailure,
} from "@/lib/wan-image-edit";
import {
  createWanHistoryId,
  fileToStoredImage,
  saveWanHistoryEntry,
  type WanHistoryEntry,
} from "@/lib/wan-image-edit-history";
import { estimateWanVideoProgressPercent } from "@/lib/wan-video";
import {
  createWanVideoHistoryId,
  fileToWanVideoStoredImage,
  saveWanVideoHistoryEntry,
  type WanVideoHistoryEntry,
} from "@/lib/wan-video-history";
import {
  saveVideoFrameClipAction,
  saveVideoFrameEditAction,
  saveVideoFrameProjectAction,
  saveVideoFrameProjectFramesAction,
} from "@/server/actions/video-frame-project.actions";
import type { VideoFrameProjectAssetDto } from "@/server/services/video-frame-project.service";
import { pollWanImageEditAction } from "@/server/actions/wan-image-edit.actions";
import { pollWanVideoAction } from "@/server/actions/wan-video.actions";
import type { VideoFrameProjectDetail } from "@/server/services/video-frame-project.service";

const JPEG_QUALITY = 0.92;
const AUTOSAVE_DEBOUNCE_MS = 600;
const PREVIEW_JPEG_QUALITY = 0.7;
const WAN_POLL_INTERVAL_MS = 2000;
const WAN_PROGRESS_TICK_MS = 500;
/** Tiny scrubber hints only — full resolution opens on click. */
const PREVIEW_MAX_WIDTH = 384;
const LIVE_FRAME_DEBOUNCE_MS = 80;
const SCRUB_HINT_HEIGHT_PX = 192;
const EXPORT_THUMB_HEIGHT_PX = 160;

const SPAN_COLORS = [
  "bg-[var(--accent-warm)]",
  "bg-[var(--rating)]",
  "bg-foreground/45",
  "bg-foreground/25",
  "bg-[color-mix(in_oklab,var(--accent-warm)_55%,black)]",
];

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(time)) {
      reject(new Error("Invalid seek time."));
      return;
    }

    const duration = video.duration;
    // Before metadata (or for some streams) duration is NaN/Infinity — never assign that.
    if (!Number.isFinite(duration) || duration <= 0) {
      reject(new Error("Video duration is not ready yet."));
      return;
    }

    const target = Math.min(Math.max(0, time), Math.max(0, duration - 0.001));
    if (!Number.isFinite(target)) {
      reject(new Error("Invalid seek target."));
      return;
    }

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Could not seek in the video."));
    };

    if (Math.abs(video.currentTime - target) < 0.001) {
      resolve();
      return;
    }

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = target;
  });
}

function isSeekableVideo(video: HTMLVideoElement | null): video is HTMLVideoElement {
  return (
    !!video &&
    video.readyState >= 1 &&
    Number.isFinite(video.duration) &&
    video.duration > 0
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function captureFrameBlob(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  time: number,
  options: { maxWidth?: number; quality: number },
): Promise<Blob> {
  await seekVideo(video, time);

  const sourceWidth = video.videoWidth || 1;
  const sourceHeight = video.videoHeight || 1;
  const maxWidth = options.maxWidth ?? sourceWidth;
  const scale = Math.min(1, maxWidth / sourceWidth);
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available in this browser.");
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Failed to encode JPG."))),
      "image/jpeg",
      options.quality,
    );
  });
}

function revokePreviewMap(map: Record<string, string>) {
  for (const url of Object.values(map)) {
    URL.revokeObjectURL(url);
  }
}

function ensurePreviewTimes(
  times: number[],
  options: {
    generation: number;
    generationRef: { current: number };
    cacheRef: { current: Record<string, string> };
    queueRef: { current: Promise<void> };
    videoRef: { current: HTMLVideoElement | null };
    canvasRef: { current: HTMLCanvasElement | null };
    setPreviewUrls: (urls: Record<string, string>) => void;
    setLoading?: (loading: boolean) => void;
    onError?: () => void;
  },
) {
  const neededKeys = new Set(times.map((time) => previewTimeKey(time)));
  const missing = times.filter((time) => !options.cacheRef.current[previewTimeKey(time)]);

  // Keep thumbnails for times still needed; drop unused later via prune.
  options.setPreviewUrls({ ...options.cacheRef.current });

  if (missing.length === 0) {
    options.setLoading?.(false);
    return;
  }

  options.setLoading?.(true);
  options.queueRef.current = options.queueRef.current.then(async () => {
    if (options.generationRef.current !== options.generation) {
      return;
    }

    const previewVideo = options.videoRef.current;
    const previewCanvas = options.canvasRef.current;
    if (!isSeekableVideo(previewVideo) || !previewCanvas) {
      if (options.generationRef.current === options.generation) {
        options.setLoading?.(false);
      }
      return;
    }

    previewVideo.pause();

    try {
      for (const time of missing) {
        if (options.generationRef.current !== options.generation) {
          return;
        }
        if (!Number.isFinite(time)) {
          continue;
        }
        const key = previewTimeKey(time);
        if (options.cacheRef.current[key]) {
          continue;
        }

        const blob = await captureFrameBlob(previewVideo, previewCanvas, time, {
          maxWidth: PREVIEW_MAX_WIDTH,
          quality: PREVIEW_JPEG_QUALITY,
        });
        if (options.generationRef.current !== options.generation) {
          return;
        }

        options.cacheRef.current[key] = URL.createObjectURL(blob);
        options.setPreviewUrls({ ...options.cacheRef.current });
      }
    } catch {
      if (options.generationRef.current === options.generation) {
        options.onError?.();
      }
    } finally {
      if (options.generationRef.current === options.generation) {
        options.setLoading?.(false);
      }
    }
  });
}

function prunePreviewCache(
  keepTimes: number[],
  cacheRef: { current: Record<string, string> },
  setPreviewUrls: (urls: Record<string, string>) => void,
) {
  const keep = new Set(keepTimes.map((time) => previewTimeKey(time)));
  for (const [key, url] of Object.entries(cacheRef.current)) {
    if (!keep.has(key)) {
      URL.revokeObjectURL(url);
      delete cacheRef.current[key];
    }
  }
  setPreviewUrls({ ...cacheRef.current });
}

function framesFromProject(project: VideoFrameProjectDetail): ExtractedFrame[] {
  return project.assets
    .filter((asset) => asset.kind === "FRAME")
    .map((asset, index) => ({
      id: asset.id,
      spanId: asset.spanId ?? "span",
      index: asset.frameIndex ?? index,
      time: asset.timeSec,
      blob: new Blob(),
      url: asset.path,
      filename: asset.fileName,
      persisted: true,
    }));
}

function editedUrlsFromProject(project: VideoFrameProjectDetail): Record<string, string> {
  const map: Record<string, string> = {};
  for (const asset of project.assets) {
    if (asset.kind !== "EDITED") {
      continue;
    }
    map[previewTimeKey(asset.timeSec)] = asset.path;
  }
  return map;
}

function clipsFromProject(project: VideoFrameProjectDetail): VideoFrameProjectAssetDto[] {
  return project.assets
    .filter((asset) => asset.kind === "CLIP")
    .sort((a, b) => b.timeSec - a.timeSec || a.fileName.localeCompare(b.fileName));
}

function findAssetNearTime(
  assets: VideoFrameProjectDetail["assets"],
  time: number,
  kind: "FRAME" | "EDITED",
) {
  const rounded = Math.round(time * 10) / 10;
  return (
    assets.find(
      (asset) =>
        asset.kind === kind && Math.round(asset.timeSec * 10) / 10 === rounded,
    ) ?? null
  );
}

function spanClipCandidates(input: {
  exportTimes: number[];
  assets: VideoFrameProjectDetail["assets"];
  editedUrls: Record<string, string>;
  previewUrls: Record<string, string>;
}): SpanClipFrameCandidate[] {
  return input.exportTimes.map((time, frameIndex) => {
    const key = previewTimeKey(time);
    const editedAsset = findAssetNearTime(input.assets, time, "EDITED");
    const frameAsset = findAssetNearTime(input.assets, time, "FRAME");
    const editedUrl = input.editedUrls[key] ?? editedAsset?.path ?? null;
    const label =
      frameIndex === 0
        ? "First"
        : frameIndex === input.exportTimes.length - 1
          ? "Last"
          : `#${frameIndex + 1}`;
    return {
      time,
      label,
      thumbUrl: editedUrl ?? input.previewUrls[key] ?? null,
      editedUrl,
      editedAssetId: editedAsset?.id ?? null,
      frameAssetId: frameAsset?.id ?? null,
    };
  });
}

export function VideoFrameExtractPanel({
  project,
  waveSpeedConfigured = false,
  kreaConfigured = false,
}: {
  project: VideoFrameProjectDetail;
  waveSpeedConfigured?: boolean;
  kreaConfigured?: boolean;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCacheRef = useRef<Record<string, string>>({});
  const previewQueueRef = useRef(Promise.resolve());
  const liveGenerationRef = useRef(0);
  const exportGenerationRef = useRef(0);
  const spansRef = useRef<FrameSpan[]>([]);
  const localFrameUrlsRef = useRef<Set<string>>(new Set());
  const [autosaveReady, setAutosaveReady] = useState(false);

  const initialDuration =
    Number.isFinite(project.durationSec) && project.durationSec > 0 ? project.durationSec : 0;
  const initialSpans =
    project.spans.length > 0
      ? project.spans
          .filter(
            (span) =>
              Number.isFinite(span.start) &&
              Number.isFinite(span.end) &&
              Number.isFinite(span.frameCount),
          )
          .map((span) =>
            initialDuration > 0 ? clampSpan(span, initialDuration) : span,
          )
      : initialDuration > 0
        ? createDefaultSpans(initialDuration)
        : [];

  const [name, setName] = useState(project.name);
  const [videoUrl] = useState<string | null>(project.videoPath);
  const [duration, setDuration] = useState(initialDuration);
  /** Live slider values while dragging. */
  const [spans, setSpans] = useState<FrameSpan[]>(initialSpans);
  /** Committed on pointer release — drives Export preview strip. */
  const [committedSpans, setCommittedSpans] = useState<FrameSpan[]>(initialSpans);
  const [frames, setFrames] = useState<ExtractedFrame[]>(() => framesFromProject(project));
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewReady, setPreviewReady] = useState(false);
  const [liveFrameLoading, setLiveFrameLoading] = useState(false);
  const [exportPreviewLoading, setExportPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [videoAspect, setVideoAspect] = useState(
    project.videoWidth && project.videoHeight
      ? project.videoWidth / project.videoHeight
      : 16 / 9,
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editedUrls, setEditedUrls] = useState<Record<string, string>>(() =>
    editedUrlsFromProject(project),
  );
  const [wanJobs, setWanJobs] = useState<Record<string, WanFrameJob>>({});
  const [wanEdit, setWanEdit] = useState<{
    label: string;
    time: number;
    url: string;
    blob: Blob | null;
  } | null>(null);
  const [wanEditLoadingTime, setWanEditLoadingTime] = useState<number | null>(null);
  const [kreaClip, setKreaClip] = useState<{
    spanIndex: number;
    candidates: SpanClipFrameCandidate[];
  } | null>(null);
  const [wanClip, setWanClip] = useState<{
    spanId: string;
    spanIndex: number;
    candidates: SpanClipFrameCandidate[];
  } | null>(null);
  const [wanClipJobs, setWanClipJobs] = useState<Record<string, WanClipJob>>({});
  const [spanClips, setSpanClips] = useState<VideoFrameProjectAssetDto[]>(() =>
    clipsFromProject(project),
  );
  const [clipLightbox, setClipLightbox] = useState<VideoFrameProjectAssetDto | null>(
    null,
  );

  useEffect(() => {
    setSpanClips(clipsFromProject(project));
  }, [project]);
  const [lightbox, setLightbox] = useState<{
    label: string;
    time: number;
    url: string;
  } | null>(null);
  const wanEditUrlRef = useRef<string | null>(null);
  const wanJobsRef = useRef(wanJobs);
  const wanSavingRef = useRef<Set<string>>(new Set());
  const wanClipJobsRef = useRef(wanClipJobs);
  const wanClipSavingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      for (const url of localFrameUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      localFrameUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      revokePreviewMap(previewCacheRef.current);
      previewCacheRef.current = {};
    };
  }, []);

  useEffect(() => {
    spansRef.current = spans;
  }, [spans]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAutosaveReady(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setEditedUrls(editedUrlsFromProject(project));
  }, [project]);

  useEffect(() => {
    wanJobsRef.current = wanJobs;
  }, [wanJobs]);

  useEffect(() => {
    wanClipJobsRef.current = wanClipJobs;
  }, [wanClipJobs]);

  const pollingJobSignature = Object.values(wanJobs)
    .filter((job) => job.phase === "polling" && job.predictionId)
    .map((job) => job.predictionId)
    .sort()
    .join("|");

  useEffect(() => {
    if (!pollingJobSignature) {
      return;
    }

    let cancelled = false;

    async function persistJobHistory(
      job: WanFrameJob,
      update: {
        status: string;
        outputs: string[];
        inferenceMs?: number;
        error?: string;
      },
    ) {
      if (!job.mainImage || !job.historyId) {
        return;
      }
      try {
        const entry: WanHistoryEntry = {
          id: job.historyId,
          createdAt: new Date().toISOString(),
          prompt: job.prompt,
          size: job.size || DEFAULT_WAN_SIZE,
          seed: job.seed,
          mainImage: await fileToStoredImage(job.mainImage),
          referenceImages: await Promise.all(
            job.referenceImages.map((file) => fileToStoredImage(file)),
          ),
          predictionId: job.predictionId ?? "",
          status: update.status,
          outputs: update.outputs,
          inferenceMs: update.inferenceMs,
          error: update.error,
          source: "video-frame",
          sourceLabel: `${project.name} · ${job.label} · ${formatVideoTime(job.time)}`,
        };
        await saveWanHistoryEntry(entry);
      } catch {
        // History is best-effort (shared Wan image edit IndexedDB).
      }
    }

    async function persistCompletedJob(job: WanFrameJob, outputUrl: string, inferenceMs?: number) {
      const key = previewTimeKey(job.time);
      if (wanSavingRef.current.has(key)) {
        return;
      }
      wanSavingRef.current.add(key);

      setWanJobs((prev) => ({
        ...prev,
        [key]: {
          ...job,
          phase: "saving",
          status: "saving",
          outputUrl,
          progress: 97,
          error: null,
          inferenceMs,
        },
      }));

      await persistJobHistory(job, {
        status: "completed",
        outputs: [outputUrl],
        inferenceMs,
      });

      try {
        const saved = await saveVideoFrameEditAction({
          projectId: project.id,
          timeSec: job.time,
          sourceUrl: outputUrl,
          prompt: job.prompt || undefined,
        });
        if (cancelled) {
          return;
        }
        if (saved.error || !saved.project) {
          setWanJobs((prev) => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? job),
              phase: "failed",
              status: "failed",
              error: saved.error ?? "Could not save edited frame.",
              progress: 0,
            },
          }));
          await persistJobHistory(job, {
            status: "failed",
            outputs: [outputUrl],
            inferenceMs,
            error: saved.error ?? "Could not save edited frame.",
          });
          return;
        }
        const edited = saved.project.assets
          .filter((asset) => asset.kind === "EDITED")
          .find(
            (asset) =>
              Math.round(asset.timeSec * 10) / 10 === Math.round(job.time * 10) / 10,
          );
        const editUrl = edited?.path ?? outputUrl;
        setEditedUrls((prev) => ({ ...prev, [key]: editUrl }));
        setWanJobs((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] ?? job),
            phase: "completed",
            status: "completed",
            outputUrl: editUrl,
            progress: 100,
            error: null,
            apiProgress: 100,
            inferenceMs,
          },
        }));
        router.refresh();
      } finally {
        wanSavingRef.current.delete(key);
      }
    }

    async function pollActiveJobs() {
      const active = Object.values(wanJobsRef.current).filter(
        (job) => job.phase === "polling" && job.predictionId,
      );
      for (const job of active) {
        if (cancelled || !job.predictionId) {
          continue;
        }
        const result = await pollWanImageEditAction(job.predictionId);
        if (cancelled) {
          return;
        }
        const key = previewTimeKey(job.time);
        const latest = wanJobsRef.current[key];
        if (!latest || latest.predictionId !== job.predictionId || latest.phase !== "polling") {
          continue;
        }

        if (result.error && result.status === "failed") {
          const failedJob: WanFrameJob = {
            ...latest,
            phase: "failed",
            status: result.status,
            error: result.error ?? "Generation failed.",
            progress: 0,
            apiProgress: result.progress ?? latest.apiProgress,
            inferenceMs: result.inferenceMs,
          };
          setWanJobs((prev) => ({ ...prev, [key]: failedJob }));
          await persistJobHistory(failedJob, {
            status: result.status,
            outputs: result.outputs,
            inferenceMs: result.inferenceMs,
            error: result.error,
          });
          continue;
        }

        if (isWanCompleted(result.status) && result.outputs[0]) {
          await persistCompletedJob(latest, result.outputs[0], result.inferenceMs);
          continue;
        }

        if (isWanTerminalFailure(result.status)) {
          const failedJob: WanFrameJob = {
            ...latest,
            phase: "failed",
            status: result.status,
            error: result.error || `Generation ${result.status}.`,
            progress: 0,
            apiProgress: result.progress ?? latest.apiProgress,
            inferenceMs: result.inferenceMs,
          };
          setWanJobs((prev) => ({ ...prev, [key]: failedJob }));
          await persistJobHistory(failedJob, {
            status: result.status,
            outputs: result.outputs,
            inferenceMs: result.inferenceMs,
            error: failedJob.error ?? undefined,
          });
          continue;
        }

        const apiProgress = result.progress ?? latest.apiProgress;
        setWanJobs((prev) => ({
          ...prev,
          [key]: {
            ...latest,
            status: result.status,
            apiProgress,
            progress: estimateWanProgressPercent({
              status: result.status,
              startedAt: latest.startedAt,
              apiProgress,
              phase: "polling",
            }),
            error: null,
          },
        }));
      }
    }

    void pollActiveJobs();
    const interval = window.setInterval(() => {
      void pollActiveJobs();
    }, WAN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollingJobSignature, project.id, project.name, router]);

  const activeWanSignature = Object.values(wanJobs)
    .filter(
      (job) =>
        job.phase === "submitting" || job.phase === "polling" || job.phase === "saving",
    )
    .map((job) => previewTimeKey(job.time))
    .sort()
    .join("|");

  useEffect(() => {
    if (!activeWanSignature) {
      return;
    }

    const tick = window.setInterval(() => {
      setWanJobs((prev) => {
        let changed = false;
        const next: Record<string, WanFrameJob> = { ...prev };
        for (const [key, job] of Object.entries(prev)) {
          if (
            job.phase !== "submitting" &&
            job.phase !== "polling" &&
            job.phase !== "saving"
          ) {
            continue;
          }
          const progress = estimateWanProgressPercent({
            status: job.status,
            startedAt: job.startedAt,
            apiProgress: job.apiProgress,
            phase: job.phase,
          });
          if (progress !== job.progress) {
            next[key] = { ...job, progress };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, WAN_PROGRESS_TICK_MS);

    return () => window.clearInterval(tick);
  }, [activeWanSignature]);

  const pollingClipJobSignature = Object.values(wanClipJobs)
    .filter((job) => job.phase === "polling" && job.predictionId)
    .map((job) => job.predictionId)
    .sort()
    .join("|");

  useEffect(() => {
    if (!pollingClipJobSignature) {
      return;
    }

    let cancelled = false;

    async function persistClipJobHistory(
      job: WanClipJob,
      update: {
        status: string;
        outputs: string[];
        inferenceMs?: number;
        error?: string;
      },
    ) {
      if (!job.historyId) {
        return;
      }
      try {
        const entry: WanVideoHistoryEntry = {
          id: job.historyId,
          createdAt: new Date().toISOString(),
          prompt: job.prompt,
          duration: job.duration,
          resolution: job.resolution,
          aspectRatio: job.aspectRatio,
          seed: job.seed,
          generateAudio: job.generateAudio,
          enablePromptExpansion: job.enablePromptExpansion,
          referenceImages: await Promise.all(
            job.referenceImages.map((file) => fileToWanVideoStoredImage(file)),
          ),
          predictionId: job.predictionId ?? "",
          status: update.status,
          outputs: update.outputs,
          inferenceMs: update.inferenceMs,
          error: update.error,
          source: "video-frame",
          sourceLabel: `${project.name} · ${job.spanLabel}`,
        };
        await saveWanVideoHistoryEntry(entry);
      } catch {
        // History is best-effort.
      }
    }

    async function persistCompletedClipJob(
      job: WanClipJob,
      outputUrl: string,
      inferenceMs?: number,
    ) {
      const key = job.spanId;
      if (wanClipSavingRef.current.has(key)) {
        return;
      }
      wanClipSavingRef.current.add(key);

      setWanClipJobs((prev) => ({
        ...prev,
        [key]: {
          ...job,
          phase: "saving",
          status: "saving",
          outputUrl,
          progress: 97,
          error: null,
          inferenceMs,
        },
      }));

      await persistClipJobHistory(job, {
        status: "completed",
        outputs: [outputUrl],
        inferenceMs,
      });

      try {
        const saved = await saveVideoFrameClipAction({
          projectId: project.id,
          spanId: job.spanId,
          timeSec: job.timeSec,
          sourceUrl: outputUrl,
          provider: "wan",
          prompt: job.prompt || undefined,
        });
        if (cancelled) {
          return;
        }
        if (saved.error || !saved.project) {
          setWanClipJobs((prev) => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? job),
              phase: "failed",
              status: "failed",
              error: saved.error ?? "Could not save clip.",
              progress: 0,
            },
          }));
          await persistClipJobHistory(job, {
            status: "failed",
            outputs: [outputUrl],
            inferenceMs,
            error: saved.error ?? "Could not save clip.",
          });
          return;
        }
        setSpanClips(clipsFromProject(saved.project));
        const spanClipAssets = saved.project.assets.filter(
          (asset) => asset.kind === "CLIP" && asset.spanId === job.spanId,
        );
        const clipUrl = spanClipAssets[spanClipAssets.length - 1]?.path ?? outputUrl;
        setWanClipJobs((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] ?? job),
            phase: "completed",
            status: "completed",
            outputUrl: clipUrl,
            progress: 100,
            error: null,
            apiProgress: 100,
            inferenceMs,
          },
        }));
        router.refresh();
      } finally {
        wanClipSavingRef.current.delete(key);
      }
    }

    async function pollActiveClipJobs() {
      const active = Object.values(wanClipJobsRef.current).filter(
        (job) => job.phase === "polling" && job.predictionId,
      );
      for (const job of active) {
        if (cancelled || !job.predictionId) {
          continue;
        }
        const result = await pollWanVideoAction(job.predictionId);
        if (cancelled) {
          return;
        }
        const key = job.spanId;
        const latest = wanClipJobsRef.current[key];
        if (
          !latest ||
          latest.predictionId !== job.predictionId ||
          latest.phase !== "polling"
        ) {
          continue;
        }

        if (result.error && result.status === "failed") {
          const failedJob: WanClipJob = {
            ...latest,
            phase: "failed",
            status: result.status,
            error: result.error ?? "Generation failed.",
            progress: 0,
            apiProgress: result.progress ?? latest.apiProgress,
            inferenceMs: result.inferenceMs,
          };
          setWanClipJobs((prev) => ({ ...prev, [key]: failedJob }));
          await persistClipJobHistory(failedJob, {
            status: result.status,
            outputs: result.outputs,
            inferenceMs: result.inferenceMs,
            error: result.error,
          });
          continue;
        }

        if (isWanCompleted(result.status) && result.outputs[0]) {
          await persistCompletedClipJob(latest, result.outputs[0], result.inferenceMs);
          continue;
        }

        if (isWanTerminalFailure(result.status)) {
          const failedJob: WanClipJob = {
            ...latest,
            phase: "failed",
            status: result.status,
            error: result.error || `Generation ${result.status}.`,
            progress: 0,
            apiProgress: result.progress ?? latest.apiProgress,
            inferenceMs: result.inferenceMs,
          };
          setWanClipJobs((prev) => ({ ...prev, [key]: failedJob }));
          await persistClipJobHistory(failedJob, {
            status: result.status,
            outputs: result.outputs,
            inferenceMs: result.inferenceMs,
            error: failedJob.error ?? undefined,
          });
          continue;
        }

        const apiProgress = result.progress ?? latest.apiProgress;
        setWanClipJobs((prev) => ({
          ...prev,
          [key]: {
            ...latest,
            status: result.status,
            apiProgress,
            progress: estimateWanVideoProgressPercent({
              status: result.status,
              startedAt: latest.startedAt,
              apiProgress,
              phase: "polling",
            }),
            error: null,
          },
        }));
      }
    }

    void pollActiveClipJobs();
    const interval = window.setInterval(() => {
      void pollActiveClipJobs();
    }, WAN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollingClipJobSignature, project.id, project.name, router]);

  const activeWanClipSignature = Object.values(wanClipJobs)
    .filter(
      (job) =>
        job.phase === "submitting" ||
        job.phase === "polling" ||
        job.phase === "saving",
    )
    .map((job) => job.spanId)
    .sort()
    .join("|");

  useEffect(() => {
    if (!activeWanClipSignature) {
      return;
    }

    const tick = window.setInterval(() => {
      setWanClipJobs((prev) => {
        let changed = false;
        const next: Record<string, WanClipJob> = { ...prev };
        for (const [key, job] of Object.entries(prev)) {
          if (
            job.phase !== "submitting" &&
            job.phase !== "polling" &&
            job.phase !== "saving"
          ) {
            continue;
          }
          const progress = estimateWanVideoProgressPercent({
            status: job.status,
            startedAt: job.startedAt,
            apiProgress: job.apiProgress,
            phase: job.phase,
          });
          if (progress !== job.progress) {
            next[key] = { ...job, progress };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, WAN_PROGRESS_TICK_MS);

    return () => window.clearInterval(tick);
  }, [activeWanClipSignature]);

  function clearLocalFrames() {
    setFrames((prev) => {
      for (const frame of prev) {
        if (localFrameUrlsRef.current.has(frame.url)) {
          URL.revokeObjectURL(frame.url);
          localFrameUrlsRef.current.delete(frame.url);
        }
      }
      return [];
    });
  }

  function closeWanEdit() {
    if (wanEditUrlRef.current) {
      URL.revokeObjectURL(wanEditUrlRef.current);
      wanEditUrlRef.current = null;
    }
    setWanEdit(null);
    setWanEditLoadingTime(null);
  }

  function buildSpanClipCandidates(exportTimes: number[]): SpanClipFrameCandidate[] | null {
    const candidates = spanClipCandidates({
      exportTimes,
      assets: project.assets,
      editedUrls,
      previewUrls,
    });
    if (candidates.length === 0) {
      setError("This span has no planned frames to generate a clip from.");
      return null;
    }
    return candidates;
  }

  function openKreaClip(spanIndex: number, exportTimes: number[]) {
    const candidates = buildSpanClipCandidates(exportTimes);
    if (!candidates) return;
    setKreaClip({ spanIndex, candidates });
  }

  function openWanClip(spanId: string, spanIndex: number, exportTimes: number[]) {
    const candidates = buildSpanClipCandidates(exportTimes);
    if (!candidates) return;
    setWanClip({ spanId, spanIndex, candidates });
  }

  function upsertWanClipJob(job: WanClipJob) {
    setWanClipJobs((prev) => {
      const existing = prev[job.spanId];
      const merged: WanClipJob = {
        ...existing,
        ...job,
        historyId: job.historyId || existing?.historyId || createWanVideoHistoryId(),
        referenceImages: job.referenceImages?.length
          ? job.referenceImages
          : (existing?.referenceImages ?? []),
        progress: estimateWanVideoProgressPercent({
          status: job.status,
          startedAt: job.startedAt,
          apiProgress: job.apiProgress,
          phase: job.phase,
        }),
      };
      return { ...prev, [job.spanId]: merged };
    });
  }

  function onWanClipJobSubmitError(spanId: string, message: string) {
    const existing = wanClipJobsRef.current[spanId];
    const failed: WanClipJob = {
      spanId,
      spanLabel: existing?.spanLabel ?? "Span",
      prompt: existing?.prompt ?? "",
      duration: existing?.duration ?? 5,
      resolution: existing?.resolution ?? "720p",
      aspectRatio: existing?.aspectRatio ?? "9:16",
      seed: existing?.seed ?? "",
      generateAudio: existing?.generateAudio ?? true,
      enablePromptExpansion: existing?.enablePromptExpansion ?? false,
      predictionId: existing?.predictionId ?? null,
      phase: "failed",
      status: "failed",
      apiProgress: null,
      progress: 0,
      error: message,
      outputUrl: existing?.outputUrl ?? null,
      startedAt: existing?.startedAt ?? Date.now(),
      historyId: existing?.historyId ?? createWanVideoHistoryId(),
      referenceImages: existing?.referenceImages ?? [],
      timeSec: existing?.timeSec ?? 0,
    };
    setWanClipJobs((prev) => ({ ...prev, [spanId]: failed }));
    if (failed.referenceImages.length > 0) {
      void (async () => {
        try {
          await saveWanVideoHistoryEntry({
            id: failed.historyId,
            createdAt: new Date().toISOString(),
            prompt: failed.prompt,
            duration: failed.duration,
            resolution: failed.resolution,
            aspectRatio: failed.aspectRatio,
            seed: failed.seed,
            generateAudio: failed.generateAudio,
            enablePromptExpansion: failed.enablePromptExpansion,
            referenceImages: await Promise.all(
              failed.referenceImages.map((file) => fileToWanVideoStoredImage(file)),
            ),
            predictionId: failed.predictionId ?? "",
            status: "failed",
            outputs: [],
            error: message,
            source: "video-frame",
            sourceLabel: `${project.name} · ${failed.spanLabel}`,
          });
        } catch {
          // History is best-effort.
        }
      })();
    }
  }

  async function captureFrameFileForKrea(time: number): Promise<File> {
    const previewVideo = previewVideoRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!isSeekableVideo(previewVideo) || !previewCanvas || !Number.isFinite(time)) {
      throw new Error("Video is not ready to capture frames yet.");
    }
    previewVideo.pause();
    const blob = await captureFrameBlob(previewVideo, previewCanvas, time, {
      quality: JPEG_QUALITY,
    });
    return new File([blob], `frame-${formatVideoTime(time)}.jpg`, {
      type: "image/jpeg",
    });
  }

  async function openWanEdit(time: number, label: string) {
    const previewVideo = previewVideoRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!isSeekableVideo(previewVideo) || !previewCanvas || !Number.isFinite(time)) {
      setError("Video is not ready for frame preview yet.");
      return;
    }

    closeWanEdit();
    setWanEditLoadingTime(time);

    try {
      previewVideo.pause();
      const blob = await captureFrameBlob(previewVideo, previewCanvas, time, {
        quality: JPEG_QUALITY,
      });
      const url = URL.createObjectURL(blob);
      wanEditUrlRef.current = url;
      setWanEdit({ label, time, url, blob });
    } catch {
      setError("Could not open frame for Wan edit.");
      closeWanEdit();
    } finally {
      setWanEditLoadingTime(null);
    }
  }

  function upsertWanJob(job: WanFrameJob) {
    const key = previewTimeKey(job.time);
    setWanJobs((prev) => {
      const existing = prev[key];
      const merged: WanFrameJob = {
        ...existing,
        ...job,
        historyId: job.historyId || existing?.historyId || createWanHistoryId(),
        size: job.size || existing?.size || DEFAULT_WAN_SIZE,
        seed: job.seed ?? existing?.seed ?? "",
        mainImage: job.mainImage ?? existing?.mainImage ?? null,
        referenceImages: job.referenceImages?.length
          ? job.referenceImages
          : (existing?.referenceImages ?? []),
        progress: estimateWanProgressPercent({
          status: job.status,
          startedAt: job.startedAt,
          apiProgress: job.apiProgress,
          phase: job.phase,
        }),
      };
      return { ...prev, [key]: merged };
    });
  }

  function onWanJobSubmitError(time: number, message: string) {
    const key = previewTimeKey(time);
    const existing = wanJobsRef.current[key];
    const failed: WanFrameJob = {
      time,
      label: existing?.label ?? "Frame",
      prompt: existing?.prompt ?? "",
      predictionId: existing?.predictionId ?? null,
      phase: "failed",
      status: "failed",
      apiProgress: null,
      progress: 0,
      error: message,
      outputUrl: existing?.outputUrl ?? null,
      startedAt: existing?.startedAt ?? Date.now(),
      historyId: existing?.historyId ?? createWanHistoryId(),
      size: existing?.size ?? DEFAULT_WAN_SIZE,
      seed: existing?.seed ?? "",
      mainImage: existing?.mainImage ?? null,
      referenceImages: existing?.referenceImages ?? [],
    };
    setWanJobs((prev) => ({ ...prev, [key]: failed }));
    if (failed.mainImage) {
      void (async () => {
        try {
          await saveWanHistoryEntry({
            id: failed.historyId,
            createdAt: new Date().toISOString(),
            prompt: failed.prompt,
            size: failed.size,
            seed: failed.seed,
            mainImage: await fileToStoredImage(failed.mainImage!),
            referenceImages: await Promise.all(
              failed.referenceImages.map((file) => fileToStoredImage(file)),
            ),
            predictionId: failed.predictionId ?? "",
            status: "failed",
            outputs: [],
            error: message,
            source: "video-frame",
            sourceLabel: `${project.name} · ${failed.label} · ${formatVideoTime(failed.time)}`,
          });
        } catch {
          // best-effort
        }
      })();
    }
  }

  async function openFullFrame(time: number, label: string) {
    const previewVideo = previewVideoRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!isSeekableVideo(previewVideo) || !previewCanvas || !Number.isFinite(time)) {
      setError("Video is not ready for frame preview yet.");
      return;
    }

    setLightbox(null);
    try {
      previewVideo.pause();
      const blob = await captureFrameBlob(previewVideo, previewCanvas, time, {
        quality: JPEG_QUALITY,
      });
      const url = URL.createObjectURL(blob);
      setLightbox({ label, time, url });
    } catch {
      setError("Could not open full-resolution frame.");
    }
  }

  function markPreviewReady() {
    if (isSeekableVideo(previewVideoRef.current)) {
      setPreviewReady(true);
    }
  }

  function onVideoLoaded() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setError("Could not read video duration.");
      return;
    }
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setVideoAspect(video.videoWidth / video.videoHeight);
    }
    const nextDuration = video.duration;
    setDuration(nextDuration);
    setError(null);
    markPreviewReady();

    if (spansRef.current.length === 0) {
      const next = createDefaultSpans(nextDuration);
      spansRef.current = next;
      setSpans(next);
      setCommittedSpans(next);
      return;
    }

    const clamped = spansRef.current.map((span) => clampSpan(span, nextDuration));
    spansRef.current = clamped;
    setSpans(clamped);
    setCommittedSpans(clamped);
  }

  function updateSpan(id: string, patch: Partial<FrameSpan>) {
    setSpans((prev) => {
      const next = prev.map((span) =>
        span.id === id ? clampSpan({ ...span, ...patch }, duration) : span,
      );
      spansRef.current = next;
      return next;
    });
  }

  function commitSpans(next?: FrameSpan[]) {
    setCommittedSpans(next ?? spansRef.current);
  }

  function addSpan() {
    if (duration <= 0) {
      return;
    }
    const last = spans[spans.length - 1];
    const start = last ? Math.min(duration, last.end) : 0;
    const end = Math.min(duration, start + Math.max(1, duration / 4));
    const nextSpan = clampSpan(
      { id: newSpanId(), start, end: Math.max(start + 0.1, end), frameCount: 4 },
      duration,
    );
    setSpans((prev) => {
      const next = [...prev, nextSpan];
      spansRef.current = next;
      setCommittedSpans(next);
      return next;
    });
  }

  function removeSpan(id: string) {
    setSpans((prev) => {
      const next = prev.filter((span) => span.id !== id);
      spansRef.current = next;
      setCommittedSpans(next);
      return next;
    });
  }

  // Autosave name + committed spans (+ video metadata once known).
  useEffect(() => {
    if (!autosaveReady || extracting) {
      return;
    }

    const timer = window.setTimeout(() => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      setSaveState("saving");
      void saveVideoFrameProjectAction({
        projectId: project.id,
        name: trimmed,
        spans: committedSpans,
        durationSec: duration > 0 ? duration : undefined,
        videoWidth: videoRef.current?.videoWidth || project.videoWidth,
        videoHeight: videoRef.current?.videoHeight || project.videoHeight,
      }).then((result) => {
        if (result.error) {
          setSaveState("error");
          setError(result.error);
          return;
        }
        setSaveState("saved");
        router.refresh();
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    autosaveReady,
    committedSpans,
    name,
    duration,
    extracting,
    project.id,
    project.videoWidth,
    project.videoHeight,
    router,
  ]);

  const timelineSpans = spans;
  const plannedMarks = committedSpans.flatMap((span, spanIndex) =>
    timestampsForSpan(span.start, span.end, span.frameCount).map((time, index) => ({
      spanId: span.id,
      spanIndex,
      index,
      time,
    })),
  );

  // Live first/last boundary frames while dragging (especially last frame above end slider).
  useEffect(() => {
    if (
      !videoUrl ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      extracting ||
      spans.length === 0 ||
      !previewReady ||
      !isSeekableVideo(previewVideoRef.current)
    ) {
      return;
    }

    const generation = liveGenerationRef.current + 1;
    liveGenerationRef.current = generation;

    const timer = window.setTimeout(() => {
      const boundaryTimes = spans.flatMap((span) => [span.start, span.end]);
      ensurePreviewTimes(boundaryTimes, {
        generation,
        generationRef: liveGenerationRef,
        cacheRef: previewCacheRef,
        queueRef: previewQueueRef,
        videoRef: previewVideoRef,
        canvasRef: previewCanvasRef,
        setPreviewUrls,
        setLoading: setLiveFrameLoading,
        onError: () => setError("Could not generate span preview thumbnails."),
      });
    }, LIVE_FRAME_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [spans, duration, videoUrl, extracting, previewReady]);

  // Full export-preview strip: only when spans are committed (pointer release).
  useEffect(() => {
    if (
      !videoUrl ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      extracting ||
      committedSpans.length === 0 ||
      !previewReady ||
      !isSeekableVideo(previewVideoRef.current)
    ) {
      return;
    }

    const generation = exportGenerationRef.current + 1;
    exportGenerationRef.current = generation;
    setExportPreviewLoading(true);

    const neededTimes = uniquePreviewTimes(committedSpans);
    prunePreviewCache(
      [
        ...neededTimes,
        ...spansRef.current.flatMap((span) => [span.start, span.end]),
      ],
      previewCacheRef,
      setPreviewUrls,
    );

    ensurePreviewTimes(neededTimes, {
      generation,
      generationRef: exportGenerationRef,
      cacheRef: previewCacheRef,
      queueRef: previewQueueRef,
      videoRef: previewVideoRef,
      canvasRef: previewCanvasRef,
      setPreviewUrls,
      setLoading: setExportPreviewLoading,
      onError: () => setError("Could not generate span preview thumbnails."),
    });
  }, [committedSpans, duration, videoUrl, extracting, previewReady]);

  const extractFrames = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const activeSpans = committedSpans;
    if (!video || !canvas || duration <= 0 || activeSpans.length === 0) {
      return;
    }

    const jobs = activeSpans.flatMap((span, spanIndex) => {
      const times = timestampsForSpan(span.start, span.end, span.frameCount);
      return times.map((time, index) => ({
        span,
        spanIndex,
        index,
        time,
        filename: `frame-s${String(spanIndex + 1).padStart(2, "0")}-${String(index + 1).padStart(3, "0")}-${formatVideoTime(time).replace(":", "m").replace(".", "s")}.jpg`,
      }));
    });

    if (jobs.length === 0) {
      setError("Add at least one span with a frame count.");
      return;
    }

    liveGenerationRef.current += 1;
    exportGenerationRef.current += 1;
    setLiveFrameLoading(false);
    setExportPreviewLoading(false);
    setExtracting(true);
    setError(null);
    setProgress({ done: 0, total: jobs.length });
    clearLocalFrames();

    const wasPaused = video.paused;
    video.pause();
    previewVideoRef.current?.pause();

    const nextFrames: ExtractedFrame[] = [];

    try {
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i]!;
        const blob = await captureFrameBlob(video, canvas, job.time, {
          quality: JPEG_QUALITY,
        });
        const url = URL.createObjectURL(blob);
        localFrameUrlsRef.current.add(url);

        nextFrames.push({
          id: crypto.randomUUID(),
          spanId: job.span.id,
          index: job.index,
          time: job.time,
          blob,
          url,
          filename: job.filename,
        });
        setProgress({ done: i + 1, total: jobs.length });
      }

      setFrames(nextFrames);

      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set(
        "framesMeta",
        JSON.stringify(
          nextFrames.map((frame) => ({
            spanId: frame.spanId,
            frameIndex: frame.index,
            timeSec: frame.time,
            fileName: frame.filename,
            width: canvas.width || undefined,
            height: canvas.height || undefined,
          })),
        ),
      );
      for (const frame of nextFrames) {
        formData.append("frameFiles", frame.blob, frame.filename);
      }

      setSaveState("saving");
      const saved = await saveVideoFrameProjectFramesAction(formData);
      if (saved.error) {
        setSaveState("error");
        setError(saved.error);
      } else if (saved.project) {
        for (const url of localFrameUrlsRef.current) {
          URL.revokeObjectURL(url);
        }
        localFrameUrlsRef.current.clear();
        setFrames(framesFromProject(saved.project));
        setSaveState("saved");
        router.refresh();
      }
    } catch (err) {
      for (const frame of nextFrames) {
        if (localFrameUrlsRef.current.has(frame.url)) {
          URL.revokeObjectURL(frame.url);
          localFrameUrlsRef.current.delete(frame.url);
        }
      }
      setError(err instanceof Error ? err.message : "Frame extraction failed.");
    } finally {
      setExtracting(false);
      if (!wasPaused) {
        void video.play().catch(() => undefined);
      }
    }
  }, [duration, committedSpans, project.id, router]);

  async function downloadAllZip() {
    if (frames.length === 0) {
      return;
    }
    const files = await Promise.all(
      frames.map(async (frame) => {
        if (frame.blob.size > 0) {
          return {
            name: frame.filename,
            data: new Uint8Array(await frame.blob.arrayBuffer()),
          };
        }
        const response = await fetch(frame.url);
        const buffer = await response.arrayBuffer();
        return {
          name: frame.filename,
          data: new Uint8Array(buffer),
        };
      }),
    );
    const base = project.videoFileName?.replace(/\.[^.]+$/, "") || project.name || "frames";
    downloadBlob(createZipBlob(files), `${base}-frames.zip`);
  }

  async function downloadFrame(frame: ExtractedFrame) {
    if (frame.blob.size > 0) {
      downloadBlob(frame.blob, frame.filename);
      return;
    }
    const response = await fetch(frame.url);
    const blob = await response.blob();
    downloadBlob(blob, frame.filename);
  }

  const plannedTotal = totalFrameCount(committedSpans);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" />
            Project video
          </CardTitle>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : null}
            {saveState === "saved" ? (
              <>
                <Check className="size-3.5" />
                Saved
              </>
            ) : null}
            {saveState === "error" ? (
              <>
                <CloudUpload className="size-3.5 text-destructive" />
                Save failed
              </>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name-field">Project name</Label>
            <Input
              id="project-name-field"
              value={name}
              maxLength={120}
              disabled={extracting}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {project.videoFileName ? (
            <p className="text-xs text-muted-foreground">{project.videoFileName}</p>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {videoUrl ? (
            <div className="overflow-hidden rounded-xl bg-black ring-1 ring-border">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="mx-auto max-h-[420px] w-full"
                onLoadedMetadata={onVideoLoaded}
              />
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>This project has no source video on disk.</AlertDescription>
            </Alert>
          )}

          {videoUrl ? (
            <video
              ref={previewVideoRef}
              src={videoUrl}
              muted
              playsInline
              preload="auto"
              className="pointer-events-none absolute h-px w-px opacity-0"
              onLoadedMetadata={markPreviewReady}
              onLoadedData={markPreviewReady}
              onCanPlay={markPreviewReady}
            />
          ) : null}

          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={previewCanvasRef} className="hidden" />
        </CardContent>
      </Card>

      {videoUrl && Number.isFinite(duration) && duration > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Frame spans</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                One range slider per span (start + end thumbs). Export preview updates on release.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addSpan}>
              <Plus className="h-3.5 w-3.5" />
              Add span
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Timeline · {formatVideoTime(duration)} · {plannedTotal} planned frames
              </span>
              {exportPreviewLoading || liveFrameLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  Updating
                </span>
              ) : null}
            </div>
            <div className="relative h-6 overflow-hidden rounded-md bg-muted ring-1 ring-border">
              {timelineSpans.map((span, index) => {
                const left = (span.start / duration) * 100;
                const width = Math.max(((span.end - span.start) / duration) * 100, 0.4);
                return (
                  <div
                    key={span.id}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-sm opacity-80",
                      SPAN_COLORS[index % SPAN_COLORS.length],
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`Span ${index + 1}: ${formatVideoTime(span.start)} – ${formatVideoTime(span.end)}`}
                  />
                );
              })}
              {plannedMarks.map((mark) => (
                <div
                  key={`${mark.spanId}-${mark.index}`}
                  className="absolute top-0 bottom-0 w-px bg-foreground/60"
                  style={{ left: `${(mark.time / duration) * 100}%` }}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {spans.map((span, index) => {
                const committed =
                  committedSpans.find((item) => item.id === span.id) ?? span;
                const exportTimes = timestampsForSpan(
                  committed.start,
                  committed.end,
                  committed.frameCount,
                );
                const startKey = previewTimeKey(span.start);
                const endKey = previewTimeKey(span.end);

                return (
                  <div
                    key={span.id}
                    className="rounded-xl border border-border bg-muted/15 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            SPAN_COLORS[index % SPAN_COLORS.length],
                          )}
                        />
                        <p className="text-sm font-medium">Span {index + 1}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatVideoTime(span.start)} – {formatVideoTime(span.end)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={extracting || exportTimes.length === 0}
                          onClick={() => openKreaClip(index, exportTimes)}
                        >
                          <Clapperboard className="size-3.5" />
                          Krea clip
                        </Button>
                        {(() => {
                          const clipJob = wanClipJobs[span.id];
                          const clipBusy =
                            clipJob != null &&
                            (clipJob.phase === "submitting" ||
                              clipJob.phase === "polling" ||
                              clipJob.phase === "saving");
                          return (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={extracting || exportTimes.length === 0}
                              onClick={() => openWanClip(span.id, index, exportTimes)}
                            >
                              {clipBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="size-3.5" />
                              )}
                              {clipBusy
                                ? `Wan ${clipJob.progress}%`
                                : clipJob?.phase === "failed"
                                  ? "Wan clip · retry"
                                  : "Wan clip"}
                            </Button>
                          );
                        })()}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove span ${index + 1}`}
                          disabled={spans.length <= 1}
                          onClick={() => removeSpan(span.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-3">
                        <DualRangeScrubber
                          start={span.start}
                          end={span.end}
                          min={0}
                          max={duration}
                          step={0.1}
                          startUrl={previewUrls[startKey]}
                          endUrl={previewUrls[endKey]}
                          loading={liveFrameLoading}
                          aspect={videoAspect}
                          disabled={extracting}
                          onChangeStart={(start) =>
                            updateSpan(span.id, {
                              start,
                              end: Math.max(start, span.end),
                            })
                          }
                          onChangeEnd={(end) =>
                            updateSpan(span.id, {
                              end,
                              start: Math.min(span.start, end),
                            })
                          }
                          onCommit={() => commitSpans()}
                          onOpenStart={() => void openFullFrame(span.start, "First frame")}
                          onOpenEnd={() => void openFullFrame(span.end, "Last frame")}
                        />

                        <div className="flex items-center gap-3">
                          <Label htmlFor={`${span.id}-count`} className="shrink-0 text-xs">
                            Frames in span
                          </Label>
                          <input
                            id={`${span.id}-count`}
                            type="range"
                            min={1}
                            max={60}
                            step={1}
                            value={span.frameCount}
                            disabled={extracting}
                            onChange={(event) =>
                              updateSpan(span.id, { frameCount: Number(event.target.value) })
                            }
                            onPointerUp={() => commitSpans()}
                            onKeyUp={() => commitSpans()}
                            className="min-w-0 flex-1 accent-foreground"
                          />
                          <Input
                            id={`${span.id}-count-input`}
                            type="number"
                            min={1}
                            max={120}
                            value={span.frameCount}
                            disabled={extracting}
                            className="w-16"
                            onChange={(event) => {
                              const frameCount = Number(event.target.value) || 1;
                              const next = spans.map((item) =>
                                item.id === span.id
                                  ? clampSpan({ ...item, frameCount }, duration)
                                  : item,
                              );
                              setSpans(next);
                              spansRef.current = next;
                              setCommittedSpans(next);
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Export preview ({exportTimes.length})
                          </p>
                          {exportPreviewLoading ? (
                            <Loader2 className="size-3 animate-spin text-muted-foreground" />
                          ) : null}
                        </div>
                        <div className="flex items-end gap-1.5 overflow-x-auto pb-0.5">
                          {exportTimes.map((time, frameIndex) => {
                            const key = previewTimeKey(time);
                            const isEdge =
                              frameIndex === 0 || frameIndex === exportTimes.length - 1;
                            const label =
                              frameIndex === 0
                                ? "First"
                                : frameIndex === exportTimes.length - 1
                                  ? "Last"
                                  : `#${frameIndex + 1}`;
                            const editedUrl = editedUrls[key];
                            const wanJob = wanJobs[key];
                            const wanBusy =
                              wanJob != null &&
                              (wanJob.phase === "submitting" ||
                                wanJob.phase === "polling" ||
                                wanJob.phase === "saving");
                            return (
                              <div
                                key={`${span.id}-export-${frameIndex}-${key}`}
                                className="flex shrink-0 flex-col items-center gap-1"
                              >
                                <TinyThumb
                                  label={label}
                                  time={time}
                                  url={previewUrls[key]}
                                  loading={
                                    (exportPreviewLoading && !previewUrls[key]) ||
                                    (wanEditLoadingTime !== null &&
                                      previewTimeKey(wanEditLoadingTime) === key)
                                  }
                                  aspect={videoAspect}
                                  height={EXPORT_THUMB_HEIGHT_PX}
                                  emphasize={isEdge}
                                  titleSuffix=" · Wan edit"
                                  onOpenFull={() => void openWanEdit(time, label)}
                                />
                                {wanBusy ? (
                                  <div className="w-full min-w-[4.5rem] max-w-[5.5rem]">
                                    <div className="mb-0.5 flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
                                      <span className="truncate">
                                        {wanJob.phase === "saving" ? "Saving" : "Wan"}
                                      </span>
                                      <span className="tabular-nums font-medium text-foreground">
                                        {wanJob.progress}%
                                      </span>
                                    </div>
                                    <div
                                      className="h-1.5 overflow-hidden rounded-full bg-muted ring-1 ring-border"
                                      role="progressbar"
                                      aria-valuenow={wanJob.progress}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                    >
                                      <div
                                        className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
                                        style={{ width: `${wanJob.progress}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : null}
                                {editedUrl ? (
                                  <TinyThumb
                                    label="Edited"
                                    time={time}
                                    url={editedUrl}
                                    loading={false}
                                    aspect={videoAspect}
                                    height={Math.round(EXPORT_THUMB_HEIGHT_PX * 0.85)}
                                    emphasize={false}
                                    titleSuffix=" · Wan edit"
                                    onOpenFull={() => void openWanEdit(time, label)}
                                  />
                                ) : wanJob?.phase === "failed" ? (
                                  <button
                                    type="button"
                                    className="max-w-[5.5rem] text-[10px] text-destructive underline-offset-2 hover:underline"
                                    onClick={() => void openWanEdit(time, label)}
                                  >
                                    Edit failed — retry
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        {(() => {
                          const clipsForSpan = spanClips.filter(
                            (clip) => clip.spanId === span.id,
                          );
                          const clipJob = wanClipJobs[span.id];
                          const clipBusy =
                            clipJob != null &&
                            (clipJob.phase === "submitting" ||
                              clipJob.phase === "polling" ||
                              clipJob.phase === "saving");
                          if (clipsForSpan.length === 0 && !clipBusy && clipJob?.phase !== "failed") {
                            return null;
                          }
                          return (
                            <div className="mt-3 grid gap-2 border-t border-border pt-3">
                              <p className="text-xs font-medium text-muted-foreground">
                                Generated clips
                                {clipsForSpan.length > 0
                                  ? ` (${clipsForSpan.length})`
                                  : ""}
                              </p>
                              {clipBusy ? (
                                <div className="rounded-lg border bg-background/80 p-2">
                                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                    <span className="truncate">
                                      Wan clip ·{" "}
                                      {clipJob.phase === "saving"
                                        ? "Saving"
                                        : (clipJob.status ?? "Generating")}
                                    </span>
                                    <span className="tabular-nums font-medium text-foreground">
                                      {clipJob.progress}%
                                    </span>
                                  </div>
                                  <div
                                    className="h-1.5 overflow-hidden rounded-full bg-muted ring-1 ring-border"
                                    role="progressbar"
                                    aria-valuenow={clipJob.progress}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  >
                                    <div
                                      className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
                                      style={{ width: `${clipJob.progress}%` }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className="mt-1.5 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                                    onClick={() =>
                                      openWanClip(span.id, index, exportTimes)
                                    }
                                  >
                                    Open dialog
                                  </button>
                                </div>
                              ) : null}
                              {clipJob?.phase === "failed" && !clipBusy ? (
                                <button
                                  type="button"
                                  className="text-left text-[11px] text-destructive underline-offset-2 hover:underline"
                                  onClick={() =>
                                    openWanClip(span.id, index, exportTimes)
                                  }
                                >
                                  Wan clip failed — retry
                                  {clipJob.error ? `: ${clipJob.error}` : ""}
                                </button>
                              ) : null}
                              <ul className="grid gap-2">
                                {clipsForSpan.map((clip) => {
                                  const provider = clip.fileName.includes("-wan-")
                                    ? "Wan"
                                    : clip.fileName.includes("-krea-")
                                      ? "Krea"
                                      : "Clip";
                                  return (
                                    <li
                                      key={clip.id}
                                      className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/80 p-2"
                                    >
                                      <video
                                        src={clip.path}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        className="h-20 w-auto max-w-[9rem] rounded-md bg-black object-contain ring-1 ring-border"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                          {provider} · {clip.fileName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {(clip.bytes / (1024 * 1024)).toFixed(2)}MB
                                        </p>
                                      </div>
                                      <div className="flex gap-1.5">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setClipLightbox(clip)}
                                        >
                                          Open
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          nativeButton={false}
                                          render={
                                            <a
                                              href={clip.path}
                                              download={clip.fileName}
                                              target="_blank"
                                              rel="noreferrer"
                                            />
                                          }
                                        >
                                          <Download className="size-3.5" />
                                        </Button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="gap-1.5"
                disabled={extracting || plannedTotal === 0}
                onClick={() => void extractFrames()}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Film className="h-4 w-4" />
                )}
                {extracting
                  ? `Extracting ${progress.done}/${progress.total}…`
                  : `Extract ${plannedTotal} JPG frames`}
              </Button>
              <p className="text-xs text-muted-foreground">
                Runs locally in the browser. Seeking may take a moment on long videos.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {frames.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Output frames</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {frames.length} JPG frames ready. Download individually or as a ZIP.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void downloadAllZip()}
            >
              <Download className="h-3.5 w-3.5" />
              Download ZIP
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              {frames.map((frame) => (
                <div key={frame.id} className="flex flex-col items-center gap-1">
                  <TinyThumb
                    label={formatVideoTime(frame.time)}
                    time={frame.time}
                    url={frame.url}
                    loading={false}
                    aspect={videoAspect}
                    onOpenFull={() => {
                      setLightbox({
                        label: frame.filename,
                        time: frame.time,
                        url: frame.url,
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Download ${frame.filename}`}
                      onClick={() => void downloadFrame(frame)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog.Root
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (lightbox?.url.startsWith("blob:")) {
              URL.revokeObjectURL(lightbox.url);
            }
            setLightbox(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,52rem)] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-lg ring-1 ring-foreground/10 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-medium">
                  {lightbox?.label ?? "Frame"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  {lightbox ? formatVideoTime(lightbox.time) : "Loading…"} · full resolution
                </Dialog.Description>
              </div>
              <Dialog.Close
                render={<Button type="button" variant="ghost" size="icon-sm" />}
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/40 p-4">
              {!lightbox?.url ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightbox.url}
                  alt={lightbox.label}
                  className="max-h-[min(80vh,44rem)] w-auto max-w-full object-contain"
                />
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {wanEdit ? (
        <VideoFrameWanEditDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeWanEdit();
            }
          }}
          time={wanEdit.time}
          label={wanEdit.label}
          imageUrl={wanEdit.url}
          imageBlob={wanEdit.blob}
          existingEditUrl={editedUrls[previewTimeKey(wanEdit.time)] ?? null}
          job={wanJobs[previewTimeKey(wanEdit.time)] ?? null}
          waveSpeedConfigured={waveSpeedConfigured}
          onJobAccepted={upsertWanJob}
          onJobSubmitError={onWanJobSubmitError}
        />
      ) : null}

      {kreaClip ? (
        <VideoFrameKreaClipDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setKreaClip(null);
            }
          }}
          spanLabel={`Span ${kreaClip.spanIndex + 1}`}
          candidates={kreaClip.candidates}
          kreaConfigured={kreaConfigured}
          videoAspect={videoAspect}
          captureFrameFile={captureFrameFileForKrea}
        />
      ) : null}

      {wanClip ? (
        <VideoFrameWanClipDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setWanClip(null);
            }
          }}
          spanId={wanClip.spanId}
          spanLabel={`Span ${wanClip.spanIndex + 1}`}
          candidates={wanClip.candidates}
          waveSpeedConfigured={waveSpeedConfigured}
          videoAspect={videoAspect}
          job={wanClipJobs[wanClip.spanId] ?? null}
          captureFrameFile={captureFrameFileForKrea}
          onJobAccepted={upsertWanClipJob}
          onJobSubmitError={onWanClipJobSubmitError}
        />
      ) : null}

      <Dialog.Root
        open={clipLightbox != null}
        onOpenChange={(open) => {
          if (!open) setClipLightbox(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Popup className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-lg outline-none">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-medium">
                  {clipLightbox?.fileName ?? "Clip"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  Generated clip · open or download
                </Dialog.Description>
              </div>
              <Dialog.Close
                render={<Button type="button" variant="ghost" size="icon-sm" />}
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-auto bg-muted/40 p-4">
              {clipLightbox ? (
                <>
                  <video
                    key={clipLightbox.path}
                    src={clipLightbox.path}
                    controls
                    playsInline
                    className="max-h-[min(70vh,40rem)] w-full rounded-lg bg-black"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    nativeButton={false}
                    render={
                      <a
                        href={clipLightbox.path}
                        download={clipLightbox.fileName}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                </>
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function DualRangeScrubber({
  start,
  end,
  min,
  max,
  step,
  startUrl,
  endUrl,
  loading,
  aspect,
  disabled,
  onChangeStart,
  onChangeEnd,
  onCommit,
  onOpenStart,
  onOpenEnd,
}: {
  start: number;
  end: number;
  min: number;
  max: number;
  step: number;
  startUrl?: string;
  endUrl?: string;
  loading: boolean;
  aspect: number;
  disabled?: boolean;
  onChangeStart: (value: number) => void;
  onChangeEnd: (value: number) => void;
  onCommit: () => void;
  onOpenStart: () => void;
  onOpenEnd: () => void;
}) {
  const span = Math.max(max - min, 0.0001);
  const startPct = ((start - min) / span) * 100;
  const endPct = ((end - min) / span) * 100;
  const startOnTop = startPct > 100 - endPct;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Start {formatVideoTime(start)}</span>
        <span>End {formatVideoTime(end)}</span>
      </div>

      <div className="relative" style={{ paddingTop: SCRUB_HINT_HEIGHT_PX + 14 }}>
        <HintThumb
          label="Start"
          url={startUrl}
          loading={loading && !startUrl}
          aspect={aspect}
          pct={startPct}
          onOpen={onOpenStart}
        />
        <HintThumb
          label="End"
          url={endUrl}
          loading={loading && !endUrl}
          aspect={aspect}
          pct={endPct}
          emphasize
          onOpen={onOpenEnd}
        />

        <div className="relative h-7">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted ring-1 ring-border" />
          <div
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/70"
            style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.5)}%` }}
          />

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={start}
            disabled={disabled}
            aria-label="Span start"
            onChange={(event) => {
              const next = Number(event.target.value);
              onChangeStart(Math.min(next, end));
            }}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            className="dual-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
            style={{ zIndex: startOnTop ? 4 : 3 }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={end}
            disabled={disabled}
            aria-label="Span end"
            onChange={(event) => {
              const next = Number(event.target.value);
              onChangeEnd(Math.max(next, start));
            }}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            className="dual-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
            style={{ zIndex: startOnTop ? 3 : 4 }}
          />
        </div>
      </div>

    </div>
  );
}

function HintThumb({
  label,
  url,
  loading,
  aspect,
  pct,
  emphasize = false,
  onOpen,
}: {
  label: string;
  url?: string;
  loading: boolean;
  aspect: number;
  pct: number;
  emphasize?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!url && !loading}
      onClick={onOpen}
      className="absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: `${pct}%` }}
      title={`${label} · click for full resolution`}
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded border bg-background shadow-sm",
          emphasize ? "border-foreground/35" : "border-border",
        )}
        style={{
          height: SCRUB_HINT_HEIGHT_PX,
          width: Math.round(SCRUB_HINT_HEIGHT_PX * aspect),
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-auto max-w-none object-contain"
            draggable={false}
          />
        ) : (
          <span className="text-muted-foreground">
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Film className="size-3.5 opacity-40" />
            )}
          </span>
        )}
      </span>
      <span className="rounded bg-background/95 px-1 text-[10px] leading-4 text-muted-foreground ring-1 ring-border">
        {label}
      </span>
    </button>
  );
}

function TinyThumb({
  label,
  time,
  url,
  loading,
  aspect,
  height = EXPORT_THUMB_HEIGHT_PX,
  emphasize = false,
  titleSuffix = " · click for full resolution",
  onOpenFull,
}: {
  label: string;
  time: number;
  url?: string;
  loading: boolean;
  aspect: number;
  height?: number;
  emphasize?: boolean;
  titleSuffix?: string;
  onOpenFull: () => void;
}) {
  const width = Math.round(height * aspect);

  return (
    <button
      type="button"
      onClick={onOpenFull}
      disabled={!url && !loading}
      className={cn(
        "flex shrink-0 flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        emphasize && "ring-1 ring-foreground/25",
      )}
      title={`${label} · ${formatVideoTime(time)}${titleSuffix}`}
    >
      <span
        className="flex items-center justify-center overflow-hidden rounded border border-border bg-background"
        style={{ height, width }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-auto max-w-none object-contain"
            draggable={false}
          />
        ) : (
          <span className="text-muted-foreground">
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Film className="size-3 opacity-40" />
            )}
          </span>
        )}
      </span>
      <span className="max-w-[4.5rem] truncate text-[10px] text-muted-foreground">
        {label}
      </span>
    </button>
  );
}
