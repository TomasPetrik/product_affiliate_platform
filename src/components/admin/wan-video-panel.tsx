"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  Clapperboard,
  Download,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  KreaVideoFramePicker,
  type PickedKreaFrame,
} from "@/components/admin/krea-video-frame-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  clampWanVideoDuration,
  DEFAULT_WAN_VIDEO_ASPECT_RATIO,
  DEFAULT_WAN_VIDEO_DURATION,
  DEFAULT_WAN_VIDEO_PROMPT,
  DEFAULT_WAN_VIDEO_RESOLUTION,
  estimateWanVideoProgressPercent,
  isWanCompleted,
  isWanTerminalFailure,
  MAX_WAN_VIDEO_IMAGE_BYTES,
  MAX_WAN_VIDEO_REFERENCE_IMAGES,
  randomWanSeed,
  wanVideoDurationChoices,
  WAN_VIDEO_ASPECT_RATIOS,
  WAN_VIDEO_RESOLUTIONS,
  type WanVideoAspectRatio,
  type WanVideoResolution,
} from "@/lib/wan-video";
import {
  createWanVideoHistoryId,
  deleteWanVideoHistoryEntry,
  fileToWanVideoStoredImage,
  formatWanVideoHistoryTime,
  listWanVideoHistory,
  saveWanVideoHistoryEntry,
  truncateWanVideoPrompt,
  wanVideoStoredImageToFile,
  type WanVideoHistoryEntry,
} from "@/lib/wan-video-history";
import {
  pollWanVideoAction,
  submitWanVideoAction,
} from "@/server/actions/wan-video.actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const POLL_INTERVAL_MS = 2500;

type JobPhase = "idle" | "submitting" | "polling" | "completed" | "failed";

function validateImageFile(candidate: File): string | null {
  if (!ACCEPT_SET.has(candidate.type)) {
    return "Use a JPEG, PNG, WebP, or GIF.";
  }
  if (candidate.size > MAX_WAN_VIDEO_IMAGE_BYTES) {
    return `Image must be ${Math.round(MAX_WAN_VIDEO_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}

function WanVideoHistoryThumb({ entry }: { entry: WanVideoHistoryEntry }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const outputUrl = entry.outputs[0] ?? null;
  const refBlob = entry.referenceImages[0]?.blob;

  useEffect(() => {
    if (outputUrl || !refBlob) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(refBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputUrl, refBlob]);

  if (outputUrl) {
    return (
      <video
        src={outputUrl}
        muted
        playsInline
        preload="metadata"
        className="size-12 shrink-0 rounded-md object-cover ring-1 ring-border"
      />
    );
  }
  if (blobUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={blobUrl}
        alt=""
        className="size-12 shrink-0 rounded-md object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Clapperboard className="size-4" />
    </div>
  );
}

interface WanVideoPanelProps {
  configured: boolean;
}

export function WanVideoPanel({ configured }: WanVideoPanelProps) {
  const [prompt, setPrompt] = useState(DEFAULT_WAN_VIDEO_PROMPT);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referenceFrames, setReferenceFrames] = useState<PickedKreaFrame[]>([]);
  const [duration, setDuration] = useState(DEFAULT_WAN_VIDEO_DURATION);
  const [resolution, setResolution] = useState<WanVideoResolution>(
    DEFAULT_WAN_VIDEO_RESOLUTION,
  );
  const [aspectRatio, setAspectRatio] = useState<WanVideoAspectRatio>(
    DEFAULT_WAN_VIDEO_ASPECT_RATIO,
  );
  const [seed, setSeed] = useState("");
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);

  const [phase, setPhase] = useState<JobPhase>("idle");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [apiProgress, setApiProgress] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const refInputId = useId();
  const [refError, setRefError] = useState<string | null>(null);
  const [refPreviewUrls, setRefPreviewUrls] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<WanVideoHistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const historyIdRef = useRef(createWanVideoHistoryId());
  const historyRefsRef = useRef<File[]>([]);

  const refCount = referenceFiles.length + referenceFrames.length;
  const durationChoices = wanVideoDurationChoices();

  useEffect(() => {
    void listWanVideoHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    const urls = referenceFiles.map((file) => URL.createObjectURL(file));
    setRefPreviewUrls(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [referenceFiles]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function refreshHistory() {
    try {
      setHistory(await listWanVideoHistory());
    } catch {
      // Keep existing list.
    }
  }

  async function persistHistory(update: {
    status: string;
    outputs: string[];
    inferenceMs?: number;
    error?: string;
  }) {
    try {
      await saveWanVideoHistoryEntry({
        id: historyIdRef.current,
        createdAt: new Date().toISOString(),
        prompt: prompt.trim(),
        duration,
        resolution,
        aspectRatio,
        seed: seed.trim(),
        generateAudio,
        enablePromptExpansion,
        referenceImages: await Promise.all(
          historyRefsRef.current.map((file) => fileToWanVideoStoredImage(file)),
        ),
        predictionId: predictionId ?? "",
        status: update.status,
        outputs: update.outputs,
        inferenceMs: update.inferenceMs,
        error: update.error,
        source: "standalone",
      });
      setActiveHistoryId(historyIdRef.current);
      await refreshHistory();
    } catch {
      // History is best-effort.
    }
  }

  useEffect(() => {
    if (phase !== "polling" && phase !== "submitting") return;
    const timer = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, [phase]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function addReferenceFiles(candidates: FileList | File[] | null) {
    setRefError(null);
    if (!candidates || candidates.length === 0) return;
    const next = [...referenceFiles];
    for (const candidate of Array.from(candidates)) {
      if (next.length + referenceFrames.length >= MAX_WAN_VIDEO_REFERENCE_IMAGES) {
        setRefError(`At most ${MAX_WAN_VIDEO_REFERENCE_IMAGES} reference images.`);
        break;
      }
      const validationError = validateImageFile(candidate);
      if (validationError) {
        setRefError(validationError);
        continue;
      }
      next.push(candidate);
    }
    setReferenceFiles(next);
    if (refInputRef.current) refInputRef.current.value = "";
  }

  async function pollOnce(id: string) {
    const result = await pollWanVideoAction(id);
    if (result.error && isWanTerminalFailure(result.status)) {
      stopPolling();
      setPhase("failed");
      setStatus(result.status);
      setError(result.error);
      await persistHistory({
        status: result.status,
        outputs: result.outputs,
        inferenceMs: result.inferenceMs,
        error: result.error,
      });
      return;
    }
    if (result.error && !result.status) {
      stopPolling();
      setPhase("failed");
      setError(result.error);
      await persistHistory({
        status: "failed",
        outputs: [],
        error: result.error,
      });
      return;
    }

    setStatus(result.status);
    setOutputs(result.outputs);
    setApiProgress(typeof result.progress === "number" ? result.progress : null);

    if (isWanCompleted(result.status)) {
      stopPolling();
      setPhase("completed");
      setError(null);
      await persistHistory({
        status: result.status,
        outputs: result.outputs,
        inferenceMs: result.inferenceMs,
      });
      return;
    }

    if (isWanTerminalFailure(result.status)) {
      stopPolling();
      setPhase("failed");
      const message = result.error || `WaveSpeed job ${result.status}.`;
      setError(message);
      await persistHistory({
        status: result.status,
        outputs: result.outputs,
        inferenceMs: result.inferenceMs,
        error: message,
      });
    }
  }

  function startPolling(id: string) {
    stopPolling();
    setPhase("polling");
    void pollOnce(id);
    pollRef.current = setInterval(() => {
      void pollOnce(id);
    }, POLL_INTERVAL_MS);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!configured || phase === "submitting" || phase === "polling") return;
    if (refCount === 0) {
      setError("Add at least one reference image.");
      return;
    }

    setError(null);
    setOutputs([]);
    setPredictionId(null);
    setStatus(null);
    setApiProgress(null);
    setActiveHistoryId(null);
    historyIdRef.current = createWanVideoHistoryId();
    historyRefsRef.current = [...referenceFiles];
    stopPolling();
    setPhase("submitting");
    setStartedAt(Date.now());

    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set("duration", String(clampWanVideoDuration(duration)));
    formData.set("aspectRatio", aspectRatio);
    formData.set("resolution", resolution);
    if (seed.trim()) formData.set("seed", seed.trim());
    if (enablePromptExpansion) formData.set("enablePromptExpansion", "1");
    formData.set("generateAudio", generateAudio ? "1" : "0");

    for (const file of referenceFiles) {
      formData.append("referenceImages", file);
    }
    for (const frame of referenceFrames) {
      formData.append("referenceFrameAssetIds", frame.assetId);
    }

    const result = await submitWanVideoAction(formData);
    if (result.error || !result.predictionId) {
      setPhase("failed");
      setError(result.error ?? "Submit failed.");
      return;
    }

    setPredictionId(result.predictionId);
    setStatus(result.status ?? "created");
    startPolling(result.predictionId);
  }

  function restoreHistoryEntry(entry: WanVideoHistoryEntry) {
    if (phase === "submitting" || phase === "polling") return;
    stopPolling();
    setPrompt(entry.prompt);
    setDuration(entry.duration);
    setResolution((entry.resolution as WanVideoResolution) || DEFAULT_WAN_VIDEO_RESOLUTION);
    setAspectRatio(
      (entry.aspectRatio as WanVideoAspectRatio) || DEFAULT_WAN_VIDEO_ASPECT_RATIO,
    );
    setSeed(entry.seed);
    setGenerateAudio(entry.generateAudio);
    setEnablePromptExpansion(entry.enablePromptExpansion);
    setReferenceFrames([]);
    setReferenceFiles(entry.referenceImages.map(wanVideoStoredImageToFile));
    setPredictionId(entry.predictionId || null);
    setStatus(entry.status);
    setOutputs(entry.outputs);
    setError(entry.error ?? null);
    setActiveHistoryId(entry.id);
    if (isWanCompleted(entry.status)) {
      setPhase("completed");
    } else if (isWanTerminalFailure(entry.status) || entry.error) {
      setPhase("failed");
    } else {
      setPhase("idle");
    }
  }

  async function removeHistoryEntry(id: string) {
    try {
      await deleteWanVideoHistoryEntry(id);
      if (activeHistoryId === id) setActiveHistoryId(null);
      await refreshHistory();
    } catch {
      setError("Could not delete history item.");
    }
  }

  const busy = phase === "submitting" || phase === "polling";
  const progress = estimateWanVideoProgressPercent({
    status,
    startedAt,
    now: nowTick,
    apiProgress,
    phase,
  });

  return (
    <div className="grid gap-6">
      {!configured ? (
        <Alert>
          <AlertDescription>
            Set <code className="text-xs">WAVESPEED_API_KEY</code> in{" "}
            <code className="text-xs">.env</code>, then restart the app. Same key as
            Wan image edit — create it at{" "}
            <a
              href="https://wavespeed.ai/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              wavespeed.ai
            </a>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,380px)]"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" />
              Wan 3.0 reference-to-video
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="wan-video-prompt">Prompt</Label>
              <Textarea
                id="wan-video-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={busy || !configured}
                required
                rows={5}
                placeholder="The product from Image 1 rotates slowly on a clean desk…"
              />
              <p className="text-xs text-muted-foreground">
                Refer to stills as Image 1, Image 2, … in array order.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>
                Reference images{" "}
                <span className="font-normal text-muted-foreground">
                  (required · up to {MAX_WAN_VIDEO_REFERENCE_IMAGES})
                </span>
              </Label>

              {referenceFrames.length > 0 ? (
                <ul className="grid gap-2">
                  {referenceFrames.map((frame, index) => (
                    <li
                      key={frame.assetId}
                      className="flex items-center gap-3 rounded-xl border bg-muted/20 p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={frame.previewPath}
                        alt=""
                        className="size-12 rounded-lg object-cover ring-1 ring-border"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          Image {index + 1} · {frame.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">Video creator</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={`Remove ${frame.fileName}`}
                        onClick={() =>
                          setReferenceFrames((prev) =>
                            prev.filter((item) => item.assetId !== frame.assetId),
                          )
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {referenceFiles.length > 0 ? (
                <ul className="grid gap-2">
                  {referenceFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                      className="flex items-center gap-3 rounded-xl border bg-muted/20 p-2"
                    >
                      {refPreviewUrls[index] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={refPreviewUrls[index]}
                          alt=""
                          className="size-12 rounded-lg object-cover ring-1 ring-border"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          Image {referenceFrames.length + index + 1} · {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)}MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setReferenceFiles((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {refCount < MAX_WAN_VIDEO_REFERENCE_IMAGES ? (
                <>
                  <input
                    ref={refInputRef}
                    id={refInputId}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="sr-only"
                    disabled={busy || !configured}
                    onChange={(event) => addReferenceFiles(event.target.files)}
                  />
                  <label
                    htmlFor={refInputId}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (!busy && configured) setDragging(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!busy && configured) setDragging(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragging(false);
                    }}
                    onDrop={(event: DragEvent<HTMLLabelElement>) => {
                      event.preventDefault();
                      setDragging(false);
                      if (busy || !configured) return;
                      addReferenceFiles(event.dataTransfer.files);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors",
                      dragging && "border-primary bg-primary/5",
                      (busy || !configured) && "pointer-events-none opacity-60",
                    )}
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                      <Plus className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Upload className="size-3.5 shrink-0" />
                        Upload references ({refCount}/{MAX_WAN_VIDEO_REFERENCE_IMAGES})
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Drag & drop or click · multi-select supported
                      </p>
                    </div>
                  </label>
                  <KreaVideoFramePicker
                    label="Add from Video creator"
                    value={null}
                    onChange={() => undefined}
                    multi
                    onAdd={(frame) => {
                      if (refCount >= MAX_WAN_VIDEO_REFERENCE_IMAGES) {
                        setRefError(
                          `At most ${MAX_WAN_VIDEO_REFERENCE_IMAGES} reference images.`,
                        );
                        return;
                      }
                      if (referenceFrames.some((f) => f.assetId === frame.assetId)) {
                        return;
                      }
                      setReferenceFrames((prev) => [...prev, frame]);
                    }}
                    excludeIds={referenceFrames.map((f) => f.assetId)}
                    disabled={busy || !configured}
                  />
                </>
              ) : null}
              {refError ? <p className="text-xs text-destructive">{refError}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="wan-video-duration">Duration (seconds)</Label>
                <select
                  id="wan-video-duration"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={duration}
                  disabled={busy || !configured}
                  onChange={(event) => setDuration(Number(event.target.value))}
                >
                  {durationChoices.map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">2–30 seconds.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="wan-video-aspect">Aspect ratio</Label>
                <select
                  id="wan-video-aspect"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={aspectRatio}
                  disabled={busy || !configured}
                  onChange={(event) =>
                    setAspectRatio(event.target.value as WanVideoAspectRatio)
                  }
                >
                  {WAN_VIDEO_ASPECT_RATIOS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="wan-video-resolution">Resolution</Label>
                <select
                  id="wan-video-resolution"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={resolution}
                  disabled={busy || !configured}
                  onChange={(event) =>
                    setResolution(event.target.value as WanVideoResolution)
                  }
                >
                  {WAN_VIDEO_RESOLUTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="wan-video-seed">Seed (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="wan-video-seed"
                    type="number"
                    inputMode="numeric"
                    placeholder="random"
                    value={seed}
                    disabled={busy || !configured}
                    onChange={(event) => setSeed(event.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Generate random seed"
                    disabled={busy || !configured}
                    onClick={() => setSeed(String(randomWanSeed()))}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="wan-video-audio">Generate audio</Label>
                <Switch
                  id="wan-video-audio"
                  checked={generateAudio}
                  disabled={busy || !configured}
                  onCheckedChange={setGenerateAudio}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="wan-video-expand">Enable prompt expansion</Label>
                <Switch
                  id="wan-video-expand"
                  checked={enablePromptExpansion}
                  disabled={busy || !configured}
                  onCheckedChange={setEnablePromptExpansion}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={busy || !configured || !prompt.trim() || refCount === 0}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "submitting" ? "Uploading…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Clapperboard className="size-4" />
                    Generate Wan video reference
                  </>
                )}
              </Button>
              {predictionId ? (
                <Badge variant="secondary" className="font-mono text-xs">
                  {predictionId}
                </Badge>
              ) : null}
              {status ? (
                <Badge
                  variant={
                    phase === "completed"
                      ? "default"
                      : phase === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {status}
                </Badge>
              ) : null}
            </div>

            {busy ? (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2 border-t pt-5">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Generation history</p>
                <span className="text-xs text-muted-foreground">
                  This browser · includes Video creator Wan clips · tap to prefill
                </span>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Completed runs from this tool and Video creator Wan clips appear here.
                </p>
              ) : (
                <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                  {history.map((entry) => {
                    const selected = activeHistoryId === entry.id;
                    return (
                      <li key={entry.id}>
                        <div
                          className={cn(
                            "flex items-stretch gap-2 rounded-xl border p-2 transition",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border bg-muted/20 hover:bg-muted/40",
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            disabled={busy}
                            onClick={() => restoreHistoryEntry(entry)}
                          >
                            <WanVideoHistoryThumb entry={entry} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {truncateWanVideoPrompt(entry.prompt)}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{formatWanVideoHistoryTime(entry.createdAt)}</span>
                                <span>{entry.duration}s</span>
                                <span>{entry.resolution}</span>
                                <span>{entry.aspectRatio}</span>
                                {entry.source === "video-frame" ? (
                                  <span className="text-foreground/80">
                                    Video creator
                                    {entry.sourceLabel ? ` · ${entry.sourceLabel}` : ""}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <Badge
                              variant={
                                isWanCompleted(entry.status)
                                  ? "default"
                                  : isWanTerminalFailure(entry.status)
                                    ? "destructive"
                                    : "outline"
                              }
                              className="shrink-0"
                            >
                              {entry.status}
                            </Badge>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 self-center"
                            aria-label="Delete history item"
                            disabled={busy}
                            onClick={() => void removeHistoryEntry(entry.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {outputs[0] ? (
              <>
                <video
                  key={outputs[0]}
                  src={outputs[0]}
                  controls
                  playsInline
                  className="w-full rounded-lg bg-black ring-1 ring-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  nativeButton={false}
                  render={
                    <a
                      href={outputs[0]}
                      download
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <Download className="size-3.5" />
                  Download video
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generated video will appear here. Add reference stills from Video
                frames or upload, then generate.
              </p>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
