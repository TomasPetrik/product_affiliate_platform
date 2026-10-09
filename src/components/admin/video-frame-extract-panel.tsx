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
  CloudUpload,
  Download,
  Film,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  saveVideoFrameProjectAction,
  saveVideoFrameProjectFramesAction,
} from "@/server/actions/video-frame-project.actions";
import type { VideoFrameProjectDetail } from "@/server/services/video-frame-project.service";

const JPEG_QUALITY = 0.92;
const AUTOSAVE_DEBOUNCE_MS = 600;
const PREVIEW_JPEG_QUALITY = 0.7;
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

export function VideoFrameExtractPanel({
  project,
}: {
  project: VideoFrameProjectDetail;
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
  const [lightbox, setLightbox] = useState<{
    label: string;
    time: number;
    url: string;
  } | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const lightboxUrlRef = useRef<string | null>(null);

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

  function closeLightbox() {
    if (lightboxUrlRef.current) {
      URL.revokeObjectURL(lightboxUrlRef.current);
      lightboxUrlRef.current = null;
    }
    setLightbox(null);
    setLightboxLoading(false);
  }

  async function openFullFrame(time: number, label: string) {
    const previewVideo = previewVideoRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!isSeekableVideo(previewVideo) || !previewCanvas || !Number.isFinite(time)) {
      setError("Video is not ready for frame preview yet.");
      return;
    }

    closeLightbox();
    setLightboxLoading(true);
    setLightbox({ label, time, url: "" });

    try {
      previewVideo.pause();
      const blob = await captureFrameBlob(previewVideo, previewCanvas, time, {
        quality: JPEG_QUALITY,
      });
      const url = URL.createObjectURL(blob);
      lightboxUrlRef.current = url;
      setLightbox({ label, time, url });
    } catch {
      setError("Could not open full-resolution frame.");
      closeLightbox();
    } finally {
      setLightboxLoading(false);
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
                            return (
                              <TinyThumb
                                key={`${span.id}-export-${frameIndex}-${key}`}
                                label={label}
                                time={time}
                                url={previewUrls[key]}
                                loading={exportPreviewLoading && !previewUrls[key]}
                                aspect={videoAspect}
                                height={EXPORT_THUMB_HEIGHT_PX}
                                emphasize={isEdge}
                                onOpenFull={() => void openFullFrame(time, label)}
                              />
                            );
                          })}
                        </div>
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
        open={lightbox !== null || lightboxLoading}
        onOpenChange={(open) => {
          if (!open) {
            closeLightbox();
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
              {lightboxLoading || !lightbox?.url ? (
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
  onOpenFull,
}: {
  label: string;
  time: number;
  url?: string;
  loading: boolean;
  aspect: number;
  height?: number;
  emphasize?: boolean;
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
      title={`${label} · ${formatVideoTime(time)} · click for full resolution`}
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
