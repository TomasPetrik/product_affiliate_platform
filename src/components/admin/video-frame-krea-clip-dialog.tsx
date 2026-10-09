"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Clapperboard,
  Download,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  clampKreaDuration,
  DEFAULT_SPAN_CLIP_MODEL_ID,
  DEFAULT_SPAN_CLIP_PROMPT,
  durationChoicesForModel,
  estimateKreaVideoProgressPercent,
  getKreaVideoModel,
  isKreaCompleted,
  isKreaTerminalFailure,
  KREA_VIDEO_MODELS,
  randomKreaSeed,
  suggestedKreaDurationFromTimes,
  type KreaVideoModelDef,
} from "@/lib/krea-video";
import { cn } from "@/lib/utils";
import { formatVideoTime } from "@/lib/video-frames";
import {
  pollKreaVideoAction,
  submitKreaVideoAction,
} from "@/server/actions/krea-video.actions";

const POLL_INTERVAL_MS = 5000;

export interface SpanClipFrameCandidate {
  time: number;
  label: string;
  thumbUrl: string | null;
  /** Prefer this when selected (Wan-edited still). */
  editedUrl: string | null;
  editedAssetId: string | null;
  frameAssetId: string | null;
}

export interface VideoFrameKreaClipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spanLabel: string;
  candidates: SpanClipFrameCandidate[];
  kreaConfigured: boolean;
  /** Source video aspect (width/height) — used to pick 9:16 vs 16:9 when supported. */
  videoAspect?: number;
  /** Capture a full-res still from the source video when no asset exists. */
  captureFrameFile: (time: number) => Promise<File>;
}

function preferredAspectForVideo(
  model: KreaVideoModelDef,
  videoAspect?: number,
): (typeof model.aspectRatios)[number] {
  const portrait = (videoAspect ?? 16 / 9) < 1;
  const preferred = portrait ? "9:16" : "16:9";
  if (model.aspectRatios.includes(preferred as (typeof model.aspectRatios)[number])) {
    return preferred as (typeof model.aspectRatios)[number];
  }
  return model.defaultAspectRatio;
}

type JobPhase = "idle" | "submitting" | "polling" | "completed" | "failed";

async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load frame (${response.status}).`);
  }
  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || "image/jpeg",
  });
}

function defaultSelectedKeys(candidates: SpanClipFrameCandidate[]): string[] {
  const edited = candidates.filter((c) => c.editedUrl || c.editedAssetId);
  const source = edited.length > 0 ? edited : candidates;
  return source.map((c) => String(c.time));
}

function pickReferenceTimes(
  times: number[],
  maxRefs: number,
): number[] {
  if (times.length <= 2 || maxRefs <= 0) {
    return [];
  }
  const middle = times.slice(1, -1);
  if (middle.length <= maxRefs) {
    return middle;
  }
  // Evenly sample middle frames when there are more than the model allows.
  const picked: number[] = [];
  for (let i = 0; i < maxRefs; i += 1) {
    const index = Math.round((i * (middle.length - 1)) / (maxRefs - 1));
    picked.push(middle[index]!);
  }
  return [...new Set(picked)];
}

export function VideoFrameKreaClipDialog({
  open,
  onOpenChange,
  spanLabel,
  candidates,
  kreaConfigured,
  videoAspect,
  captureFrameFile,
}: VideoFrameKreaClipDialogProps) {
  const [modelId, setModelId] = useState(DEFAULT_SPAN_CLIP_MODEL_ID);
  const model = getKreaVideoModel(modelId) ?? KREA_VIDEO_MODELS[0]!;
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    defaultSelectedKeys(candidates),
  );
  const [prompt, setPrompt] = useState(DEFAULT_SPAN_CLIP_PROMPT);
  const [duration, setDuration] = useState(model.defaultDuration);
  const [resolution, setResolution] = useState(model.defaultResolution);
  const [aspectRatio, setAspectRatio] = useState(model.defaultAspectRatio);
  const [seed, setSeed] = useState("");
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [apiProgress, setApiProgress] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedForOpen = useRef(false);

  const selectedCandidates = useMemo(() => {
    const selected = new Set(selectedKeys);
    return candidates
      .filter((c) => selected.has(String(c.time)))
      .sort((a, b) => a.time - b.time);
  }, [candidates, selectedKeys]);

  const selectedTimes = selectedCandidates.map((c) => c.time);

  useEffect(() => {
    if (!open) {
      initializedForOpen.current = false;
      stopPolling();
      return;
    }
    if (initializedForOpen.current) {
      return;
    }
    initializedForOpen.current = true;

    const nextModel =
      getKreaVideoModel(DEFAULT_SPAN_CLIP_MODEL_ID) ?? KREA_VIDEO_MODELS[0]!;
    const nextSelected = defaultSelectedKeys(candidates);
    const nextTimes = candidates
      .filter((c) => nextSelected.includes(String(c.time)))
      .map((c) => c.time)
      .sort((a, b) => a - b);

    setModelId(DEFAULT_SPAN_CLIP_MODEL_ID);
    setSelectedKeys(nextSelected);
    setPrompt(DEFAULT_SPAN_CLIP_PROMPT);
    setDuration(suggestedKreaDurationFromTimes(nextTimes, nextModel));
    setResolution(nextModel.defaultResolution);
    setAspectRatio(preferredAspectForVideo(nextModel, videoAspect));
    setSeed("");
    setPhase("idle");
    setJobId(null);
    setStatus(null);
    setUrls([]);
    setApiProgress(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per open
  }, [open, candidates]);

  useEffect(() => {
    if (!open || phase === "submitting" || phase === "polling") {
      return;
    }
    setDuration(suggestedKreaDurationFromTimes(selectedTimes, model));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when selection/model changes while idle
  }, [selectedKeys, modelId]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

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

  function applyModel(next: KreaVideoModelDef) {
    setModelId(next.id);
    setResolution(next.defaultResolution);
    setAspectRatio(preferredAspectForVideo(next, videoAspect));
    setDuration(suggestedKreaDurationFromTimes(selectedTimes, next));
  }

  function toggleFrame(time: number) {
    const key = String(time);
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  function selectEditedOnly() {
    const edited = candidates.filter((c) => c.editedUrl || c.editedAssetId);
    setSelectedKeys(
      (edited.length > 0 ? edited : candidates).map((c) => String(c.time)),
    );
  }

  function selectAll() {
    setSelectedKeys(candidates.map((c) => String(c.time)));
  }

  async function resolveCandidate(
    candidate: SpanClipFrameCandidate,
  ): Promise<{ assetId?: string; file?: File }> {
    if (candidate.editedAssetId) {
      return { assetId: candidate.editedAssetId };
    }
    if (candidate.editedUrl) {
      return {
        file: await urlToFile(
          candidate.editedUrl,
          `edited-${formatVideoTime(candidate.time)}.jpg`,
        ),
      };
    }
    if (candidate.frameAssetId) {
      return { assetId: candidate.frameAssetId };
    }
    return { file: await captureFrameFile(candidate.time) };
  }

  async function pollOnce(id: string) {
    const result = await pollKreaVideoAction(id);
    if (result.error && isKreaTerminalFailure(result.status)) {
      stopPolling();
      setPhase("failed");
      setStatus(result.status);
      setError(result.error);
      return;
    }
    if (result.error && !result.status) {
      stopPolling();
      setPhase("failed");
      setError(result.error);
      return;
    }

    setStatus(result.status);
    setUrls(result.urls);
    setApiProgress(typeof result.progress === "number" ? result.progress : null);

    if (isKreaCompleted(result.status)) {
      stopPolling();
      setPhase("completed");
      setError(null);
      return;
    }

    if (isKreaTerminalFailure(result.status)) {
      stopPolling();
      setPhase("failed");
      setError(result.error || `Krea job ${result.status}.`);
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
    if (!kreaConfigured || phase === "submitting" || phase === "polling") {
      return;
    }
    if (selectedCandidates.length === 0) {
      setError("Select at least one frame.");
      return;
    }

    setError(null);
    setUrls([]);
    setJobId(null);
    setStatus(null);
    setApiProgress(null);
    stopPolling();
    setPhase("submitting");
    setStartedAt(Date.now());

    try {
      const formData = new FormData();
      formData.set("modelId", model.id);
      formData.set("prompt", prompt.trim());
      formData.set(
        "duration",
        String(clampKreaDuration(model, duration)),
      );
      formData.set("aspectRatio", aspectRatio);
      if (model.resolutions.length > 0) {
        formData.set("resolution", resolution);
      }
      if (seed.trim()) {
        formData.set("seed", seed.trim());
      }

      const start = selectedCandidates[0]!;
      const end =
        selectedCandidates.length > 1
          ? selectedCandidates[selectedCandidates.length - 1]!
          : null;
      const refTimes = pickReferenceTimes(
        selectedCandidates.map((c) => c.time),
        model.maxReferenceImages,
      );
      const refs = selectedCandidates.filter((c) => refTimes.includes(c.time));

      const startSource = await resolveCandidate(start);
      if (startSource.assetId) {
        formData.set("startFrameAssetId", startSource.assetId);
      } else if (startSource.file) {
        formData.set("startImage", startSource.file);
      }

      if (end && model.supportsEndImage) {
        const endSource = await resolveCandidate(end);
        if (endSource.assetId) {
          formData.set("endFrameAssetId", endSource.assetId);
        } else if (endSource.file) {
          formData.set("endImage", endSource.file);
        }
      }

      for (const ref of refs) {
        const source = await resolveCandidate(ref);
        if (source.assetId) {
          formData.append("referenceFrameAssetIds", source.assetId);
        } else if (source.file) {
          formData.append("referenceImages", source.file);
        }
      }

      const result = await submitKreaVideoAction(formData);
      if (result.error || !result.jobId) {
        setPhase("failed");
        setError(result.error ?? "Submit failed.");
        return;
      }

      setJobId(result.jobId);
      setStatus(result.status ?? "queued");
      startPolling(result.jobId);
    } catch (submitError) {
      setPhase("failed");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to prepare frames for Krea.",
      );
    }
  }

  const busy = phase === "submitting" || phase === "polling";
  const progress = estimateKreaVideoProgressPercent({
    status,
    startedAt,
    now: nowTick,
    apiProgress,
    phase,
  });
  const durationChoices = durationChoicesForModel(model);
  const editedCount = candidates.filter((c) => c.editedUrl || c.editedAssetId).length;

  const modelsByGroup = KREA_VIDEO_MODELS.reduce(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {} as Record<string, KreaVideoModelDef[]>,
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-x-3 top-[4vh] z-50 mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-lg outline-none sm:inset-x-auto">
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
                <Clapperboard className="size-4 shrink-0" />
                Generate clip · {spanLabel}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Choose frames, then generate with Seedance (defaults to 1.0 Pro).
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              {!kreaConfigured ? (
                <Alert>
                  <AlertDescription>
                    Set <code className="text-xs">KREA_API_KEY</code> in{" "}
                    <code className="text-xs">.env</code> and restart the app.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Frames in span</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={selectEditedOnly}
                    >
                      Edited only ({editedCount})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={selectAll}
                    >
                      All ({candidates.length})
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Default selects all Wan-edited stills when available. First → start
                  frame, last → end frame, middle → references.
                </p>
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No planned frames in this span yet.
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {candidates.map((candidate) => {
                      const key = String(candidate.time);
                      const checked = selectedKeys.includes(key);
                      const isEdited = Boolean(
                        candidate.editedUrl || candidate.editedAssetId,
                      );
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleFrame(candidate.time)}
                            className={cn(
                              "group relative flex w-full flex-col overflow-hidden rounded-lg ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              checked
                                ? "ring-foreground"
                                : "ring-border hover:ring-foreground/40",
                              busy && "opacity-60",
                            )}
                          >
                            {candidate.thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={candidate.thumbUrl}
                                alt=""
                                className="aspect-[9/16] w-full bg-muted object-cover"
                              />
                            ) : (
                              <div className="flex aspect-[9/16] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                                …
                              </div>
                            )}
                            <span className="flex items-center justify-between gap-1 px-1.5 py-1 text-[10px] text-muted-foreground">
                              <span className="truncate">{candidate.label}</span>
                              <span className="tabular-nums">
                                {formatVideoTime(candidate.time)}
                              </span>
                            </span>
                            {isEdited ? (
                              <Badge
                                variant="secondary"
                                className="absolute top-1 left-1 px-1 py-0 text-[9px]"
                              >
                                Edited
                              </Badge>
                            ) : null}
                            <span
                              className={cn(
                                "absolute top-1 right-1 flex size-4 items-center justify-center rounded border text-[10px]",
                                checked
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-background/80",
                              )}
                            >
                              {checked ? "✓" : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="span-krea-model">Model</Label>
                <select
                  id="span-krea-model"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={modelId}
                  disabled={busy || !kreaConfigured}
                  onChange={(event) => {
                    const next = getKreaVideoModel(event.target.value);
                    if (next) applyModel(next);
                  }}
                >
                  {Object.entries(modelsByGroup).map(([group, models]) => (
                    <optgroup key={group} label={group}>
                      {models.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="span-krea-prompt">Prompt</Label>
                <Textarea
                  id="span-krea-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={busy || !kreaConfigured}
                  required
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="span-krea-duration">Duration (seconds)</Label>
                  <select
                    id="span-krea-duration"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={duration}
                    disabled={busy || !kreaConfigured}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  >
                    {durationChoices.map((value) => (
                      <option key={value} value={value}>
                        {value}s
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Prefill ≈ Δ between first and last selected frame
                    {selectedTimes.length >= 2
                      ? ` (${(selectedTimes[selectedTimes.length - 1]! - selectedTimes[0]!).toFixed(1)}s)`
                      : ""}
                    .
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="span-krea-aspect">Aspect ratio</Label>
                  <select
                    id="span-krea-aspect"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={aspectRatio}
                    disabled={busy || !kreaConfigured}
                    onChange={(event) =>
                      setAspectRatio(event.target.value as typeof aspectRatio)
                    }
                  >
                    {model.aspectRatios.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                {model.resolutions.length > 0 ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="span-krea-resolution">Resolution</Label>
                    <select
                      id="span-krea-resolution"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={resolution}
                      disabled={busy || !kreaConfigured}
                      onChange={(event) =>
                        setResolution(event.target.value as typeof resolution)
                      }
                    >
                      {model.resolutions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="grid gap-1.5">
                  <Label htmlFor="span-krea-seed">Seed (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="span-krea-seed"
                      type="number"
                      inputMode="numeric"
                      placeholder="random"
                      value={seed}
                      disabled={busy || !kreaConfigured}
                      onChange={(event) => setSeed(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Generate random seed"
                      disabled={busy || !kreaConfigured}
                      onClick={() => setSeed(String(randomKreaSeed()))}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {busy ? (
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {phase === "submitting" ? "Uploading frames…" : "Generating…"}
                    </span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {jobId ? (
                    <Badge variant="secondary" className="w-fit font-mono text-xs">
                      {jobId}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {urls[0] ? (
                <div className="grid gap-3">
                  <video
                    key={urls[0]}
                    src={urls[0]}
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
                        href={urls[0]}
                        download
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <Download className="size-3.5" />
                    Download clip
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {selectedCandidates.length} frame
                {selectedCandidates.length === 1 ? "" : "s"} selected
                {status ? ` · ${status}` : ""}
              </p>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !kreaConfigured ||
                  !prompt.trim() ||
                  selectedCandidates.length === 0
                }
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "submitting" ? "Uploading…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Clapperboard className="size-4" />
                    Generate clip
                  </>
                )}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
