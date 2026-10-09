"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Download,
  Film,
  Loader2,
  Plus,
  Trash2,
  Upload,
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
  timestampsForSpan,
  totalFrameCount,
  type ExtractedFrame,
  type FrameSpan,
} from "@/lib/video-frames";
import { cn } from "@/lib/utils";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v";
const ACCEPT_SET = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const JPEG_QUALITY = 0.92;

const SPAN_COLORS = [
  "bg-[var(--accent-warm)]",
  "bg-[var(--rating)]",
  "bg-foreground/45",
  "bg-foreground/25",
  "bg-[color-mix(in_oklab,var(--accent-warm)_55%,black)]",
];

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.001));

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function VideoFrameExtractPanel() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [spans, setSpans] = useState<FrameSpan[]>([]);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      for (const frame of frames) {
        URL.revokeObjectURL(frame.url);
      }
    };
  }, [frames]);

  function clearFrames() {
    setFrames((prev) => {
      for (const frame of prev) {
        URL.revokeObjectURL(frame.url);
      }
      return [];
    });
  }

  function selectFile(candidate: File | null) {
    setError(null);
    clearFrames();

    if (!candidate) {
      setFile(null);
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setDuration(0);
      setSpans([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    if (!ACCEPT_SET.has(candidate.type) && !/\.(mp4|webm|mov|m4v)$/i.test(candidate.name)) {
      setError("Use an MP4, WebM, or MOV video.");
      return;
    }

    if (candidate.size > MAX_VIDEO_BYTES) {
      setError(`Video must be ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB or smaller.`);
      return;
    }

    setFile(candidate);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(candidate);
    });
    setDuration(0);
    setSpans([]);
  }

  function onVideoLoaded() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setError("Could not read video duration.");
      return;
    }
    setDuration(video.duration);
    setSpans(createDefaultSpans(video.duration));
  }

  function updateSpan(id: string, patch: Partial<FrameSpan>) {
    setSpans((prev) =>
      prev.map((span) =>
        span.id === id ? clampSpan({ ...span, ...patch }, duration) : span,
      ),
    );
  }

  function addSpan() {
    if (duration <= 0) {
      return;
    }
    const last = spans[spans.length - 1];
    const start = last ? Math.min(duration, last.end) : 0;
    const end = Math.min(duration, start + Math.max(1, duration / 4));
    setSpans((prev) => [
      ...prev,
      clampSpan(
        { id: newSpanId(), start, end: Math.max(start + 0.1, end), frameCount: 4 },
        duration,
      ),
    ]);
  }

  function removeSpan(id: string) {
    setSpans((prev) => prev.filter((span) => span.id !== id));
  }

  const plannedMarks = spans.flatMap((span, spanIndex) =>
    timestampsForSpan(span.start, span.end, span.frameCount).map((time, index) => ({
      spanId: span.id,
      spanIndex,
      index,
      time,
    })),
  );

  const extractFrames = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || duration <= 0 || spans.length === 0) {
      return;
    }

    const jobs = spans.flatMap((span, spanIndex) => {
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

    setExtracting(true);
    setError(null);
    setProgress({ done: 0, total: jobs.length });
    clearFrames();

    const wasPaused = video.paused;
    video.pause();

    const nextFrames: ExtractedFrame[] = [];

    try {
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i]!;
        await seekVideo(video, job.time);

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas is not available in this browser.");
        }
        ctx.drawImage(video, 0, 0);

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("Failed to encode JPG."))),
            "image/jpeg",
            JPEG_QUALITY,
          );
        });

        nextFrames.push({
          id: crypto.randomUUID(),
          spanId: job.span.id,
          index: job.index,
          time: job.time,
          blob,
          url: URL.createObjectURL(blob),
          filename: job.filename,
        });
        setProgress({ done: i + 1, total: jobs.length });
      }

      setFrames(nextFrames);
    } catch (err) {
      for (const frame of nextFrames) {
        URL.revokeObjectURL(frame.url);
      }
      setError(err instanceof Error ? err.message : "Frame extraction failed.");
    } finally {
      setExtracting(false);
      if (!wasPaused) {
        void video.play().catch(() => undefined);
      }
    }
  }, [duration, spans]);

  async function downloadAllZip() {
    if (frames.length === 0) {
      return;
    }
    const files = await Promise.all(
      frames.map(async (frame) => ({
        name: frame.filename,
        data: new Uint8Array(await frame.blob.arrayBuffer()),
      })),
    );
    const base = file?.name.replace(/\.[^.]+$/, "") || "frames";
    downloadBlob(createZipBlob(files), `${base}-frames.zip`);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  const maxMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
  const plannedTotal = totalFrameCount(spans);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" />
            Upload video
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={extracting}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />

          <label
            htmlFor={inputId}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!extracting) setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!extracting) setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors",
              dragging && "border-primary bg-primary/5",
              extracting && "pointer-events-none opacity-60",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-16 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                <Upload className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {file ? "Ready to extract" : "Drag & drop a video"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {file
                    ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)}MB`
                    : `or click to browse · MP4, WebM, MOV · ${maxMb}MB max`}
                </p>
              </div>
              {file ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear selected video"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectFile(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          </label>

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
          ) : null}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      {duration > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Frame spans</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Highlight ranges on the timeline and set how many frames each span should produce.
                With 2+ frames, the first and last of the span are always included.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addSpan}>
              <Plus className="h-3.5 w-3.5" />
              Add span
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="relative h-10 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                {spans.map((span, index) => {
                  const left = (span.start / duration) * 100;
                  const width = Math.max(((span.end - span.start) / duration) * 100, 0.4);
                  return (
                    <div
                      key={span.id}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md opacity-80",
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
                    className="absolute top-0 bottom-0 w-px bg-foreground/70"
                    style={{ left: `${(mark.time / duration) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0:00.0</span>
                <span>{formatVideoTime(duration)} · {plannedTotal} planned frames</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {spans.map((span, index) => (
                <div
                  key={span.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          SPAN_COLORS[index % SPAN_COLORS.length],
                        )}
                      />
                      <p className="text-sm font-medium">Span {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatVideoTime(span.start)} – {formatVideoTime(span.end)} ·{" "}
                        {span.frameCount} frames
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

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${span.id}-start`}>
                        Start ({formatVideoTime(span.start)})
                      </Label>
                      <input
                        id={`${span.id}-start`}
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={span.start}
                        disabled={extracting}
                        onChange={(event) => {
                          const start = Number(event.target.value);
                          updateSpan(span.id, {
                            start,
                            end: Math.max(start, span.end),
                          });
                        }}
                        className="w-full accent-foreground"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${span.id}-end`}>
                        End ({formatVideoTime(span.end)})
                      </Label>
                      <input
                        id={`${span.id}-end`}
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={span.end}
                        disabled={extracting}
                        onChange={(event) => {
                          const end = Number(event.target.value);
                          updateSpan(span.id, {
                            end,
                            start: Math.min(span.start, end),
                          });
                        }}
                        className="w-full accent-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${span.id}-count`}>
                        Frames in span ({span.frameCount})
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
                        className="w-full accent-foreground"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${span.id}-count-input`}>Exact count</Label>
                      <Input
                        id={`${span.id}-count-input`}
                        type="number"
                        min={1}
                        max={120}
                        value={span.frameCount}
                        disabled={extracting}
                        onChange={(event) =>
                          updateSpan(span.id, {
                            frameCount: Number(event.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className="group flex flex-col overflow-hidden rounded-lg bg-muted ring-1 ring-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frame.url}
                    alt={frame.filename}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 p-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {formatVideoTime(frame.time)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Download ${frame.filename}`}
                      onClick={() => downloadBlob(frame.blob, frame.filename)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
