"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Clapperboard, Download, Loader2, RefreshCw, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatVideoTime } from "@/lib/video-frames";
import {
  clampWanVideoDuration,
  DEFAULT_WAN_VIDEO_DURATION,
  DEFAULT_WAN_VIDEO_PROMPT,
  DEFAULT_WAN_VIDEO_RESOLUTION,
  estimateWanVideoProgressPercent,
  MAX_WAN_VIDEO_REFERENCE_IMAGES,
  preferredWanVideoAspect,
  randomWanSeed,
  suggestedWanVideoDurationFromTimes,
  wanVideoDurationChoices,
  WAN_VIDEO_ASPECT_RATIOS,
  WAN_VIDEO_RESOLUTIONS,
  type WanVideoAspectRatio,
  type WanVideoResolution,
} from "@/lib/wan-video";
import type { SpanClipFrameCandidate } from "@/components/admin/video-frame-krea-clip-dialog";
import { createWanVideoHistoryId } from "@/lib/wan-video-history";
import { submitWanVideoAction } from "@/server/actions/wan-video.actions";

export type WanClipJobPhase =
  | "submitting"
  | "polling"
  | "saving"
  | "completed"
  | "failed";

export interface WanClipJob {
  spanId: string;
  spanLabel: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  predictionId: string | null;
  phase: WanClipJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  referenceImages: File[];
  timeSec: number;
  inferenceMs?: number;
}

export interface VideoFrameWanClipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spanId: string;
  spanLabel: string;
  candidates: SpanClipFrameCandidate[];
  waveSpeedConfigured: boolean;
  videoAspect?: number;
  job?: WanClipJob | null;
  captureFrameFile: (time: number) => Promise<File>;
  onJobAccepted: (job: WanClipJob) => void;
  onJobSubmitError: (spanId: string, error: string) => void;
}

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

type FrameSourceKind = "edited" | "original";

function defaultSelectedKeys(candidates: SpanClipFrameCandidate[]): string[] {
  return candidates
    .slice(0, MAX_WAN_VIDEO_REFERENCE_IMAGES)
    .map((c) => String(c.time));
}

function defaultFrameSources(
  candidates: SpanClipFrameCandidate[],
): Record<string, FrameSourceKind> {
  const next: Record<string, FrameSourceKind> = {};
  for (const candidate of candidates) {
    const key = String(candidate.time);
    next[key] =
      candidate.editedUrl || candidate.editedAssetId ? "edited" : "original";
  }
  return next;
}

function candidateDisplayUrl(
  candidate: SpanClipFrameCandidate,
  source: FrameSourceKind,
): string | null {
  if (source === "edited") {
    return candidate.editedUrl ?? candidate.originalThumbUrl ?? candidate.thumbUrl;
  }
  return candidate.originalThumbUrl ?? candidate.thumbUrl;
}

function WanClipProgressBar({
  progress,
  status,
  phase,
}: {
  progress: number;
  status: string | null;
  phase: WanClipJobPhase | "idle";
}) {
  const label =
    phase === "submitting"
      ? "Uploading…"
      : phase === "saving"
        ? "Saving…"
        : phase === "completed"
          ? "Done"
          : phase === "failed"
            ? "Failed"
            : (status ?? "Processing");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        <span className="tabular-nums font-medium text-foreground">{progress}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-border"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        You can close this dialog — generation continues in the background on the span.
      </p>
    </div>
  );
}

export function VideoFrameWanClipDialog({
  open,
  onOpenChange,
  spanId,
  spanLabel,
  candidates,
  waveSpeedConfigured,
  videoAspect,
  job,
  captureFrameFile,
  onJobAccepted,
  onJobSubmitError,
}: VideoFrameWanClipDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    defaultSelectedKeys(candidates),
  );
  const [frameSources, setFrameSources] = useState<Record<string, FrameSourceKind>>(
    () => defaultFrameSources(candidates),
  );
  const [prompt, setPrompt] = useState(DEFAULT_WAN_VIDEO_PROMPT);
  const [duration, setDuration] = useState(DEFAULT_WAN_VIDEO_DURATION);
  const [resolution, setResolution] = useState<WanVideoResolution>(
    DEFAULT_WAN_VIDEO_RESOLUTION,
  );
  const [aspectRatio, setAspectRatio] = useState<WanVideoAspectRatio>(
    preferredWanVideoAspect(videoAspect),
  );
  const [seed, setSeed] = useState("");
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedCandidates = useMemo(() => {
    const selected = new Set(selectedKeys);
    return candidates
      .filter((c) => selected.has(String(c.time)))
      .sort((a, b) => a.time - b.time);
  }, [candidates, selectedKeys]);

  const selectedTimes = selectedCandidates.map((c) => c.time);

  const busy =
    localSubmitting ||
    job?.phase === "submitting" ||
    job?.phase === "polling" ||
    job?.phase === "saving";

  const displayOutput = job?.outputUrl ?? null;
  const displayProgress =
    job != null
      ? estimateWanVideoProgressPercent({
          status: job.status,
          startedAt: job.startedAt,
          apiProgress: job.apiProgress,
          phase: job.phase,
        })
      : localSubmitting
        ? 6
        : 0;

  useEffect(() => {
    if (!open) return;

    if (
      job &&
      (job.phase === "polling" ||
        job.phase === "submitting" ||
        job.phase === "saving")
    ) {
      setPrompt(job.prompt || DEFAULT_WAN_VIDEO_PROMPT);
      setDuration(job.duration);
      setResolution((job.resolution as WanVideoResolution) || DEFAULT_WAN_VIDEO_RESOLUTION);
      setAspectRatio(
        (job.aspectRatio as WanVideoAspectRatio) ||
          preferredWanVideoAspect(videoAspect),
      );
      setSeed(job.seed);
      setGenerateAudio(job.generateAudio);
      setEnablePromptExpansion(job.enablePromptExpansion);
      setLocalError(job.error);
      setLocalSubmitting(false);
      return;
    }
    if (job?.phase === "failed") {
      setPrompt(job.prompt || DEFAULT_WAN_VIDEO_PROMPT);
      setDuration(job.duration);
      setLocalError(job.error);
      setLocalSubmitting(false);
      return;
    }
    if (job?.phase === "completed") {
      setPrompt(job.prompt || DEFAULT_WAN_VIDEO_PROMPT);
      setDuration(job.duration);
      setLocalError(null);
      setLocalSubmitting(false);
      return;
    }

    const nextSelected = defaultSelectedKeys(candidates);
    const nextTimes = candidates
      .filter((c) => nextSelected.includes(String(c.time)))
      .map((c) => c.time)
      .sort((a, b) => a - b);

    setSelectedKeys(nextSelected);
    setFrameSources(defaultFrameSources(candidates));
    setPrompt(DEFAULT_WAN_VIDEO_PROMPT);
    setDuration(suggestedWanVideoDurationFromTimes(nextTimes));
    setResolution(DEFAULT_WAN_VIDEO_RESOLUTION);
    setAspectRatio(preferredWanVideoAspect(videoAspect));
    setSeed("");
    setEnablePromptExpansion(false);
    setGenerateAudio(true);
    setLocalSubmitting(false);
    setLocalError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/sync when dialog opens or job phase changes
  }, [open, spanId, job?.phase, job?.predictionId, job?.prompt, job?.error]);

  useEffect(() => {
    if (!open || busy) return;
    if (job?.phase === "completed" || job?.phase === "failed") return;
    setDuration(suggestedWanVideoDurationFromTimes(selectedTimes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKeys]);

  function toggleFrame(time: number) {
    const key = String(time);
    setSelectedKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      if (prev.length >= MAX_WAN_VIDEO_REFERENCE_IMAGES) {
        setLocalError(`At most ${MAX_WAN_VIDEO_REFERENCE_IMAGES} reference images.`);
        return prev;
      }
      setLocalError(null);
      return [...prev, key];
    });
  }

  function selectAll() {
    setSelectedKeys(
      candidates
        .slice(0, MAX_WAN_VIDEO_REFERENCE_IMAGES)
        .map((c) => String(c.time)),
    );
  }

  function selectEditedOnly() {
    const edited = candidates.filter((c) => c.editedUrl || c.editedAssetId);
    setSelectedKeys(
      edited.slice(0, MAX_WAN_VIDEO_REFERENCE_IMAGES).map((c) => String(c.time)),
    );
    setFrameSources((prev) => {
      const next = { ...prev };
      for (const candidate of edited) {
        next[String(candidate.time)] = "edited";
      }
      return next;
    });
  }

  function selectOriginalsOnly() {
    setSelectedKeys(
      candidates
        .slice(0, MAX_WAN_VIDEO_REFERENCE_IMAGES)
        .map((c) => String(c.time)),
    );
    setFrameSources((prev) => {
      const next = { ...prev };
      for (const candidate of candidates) {
        next[String(candidate.time)] = "original";
      }
      return next;
    });
  }

  function setAllSources(kind: FrameSourceKind) {
    setFrameSources((prev) => {
      const next = { ...prev };
      for (const key of selectedKeys) {
        const candidate = candidates.find((c) => String(c.time) === key);
        if (kind === "edited" && !(candidate?.editedUrl || candidate?.editedAssetId)) {
          next[key] = "original";
          continue;
        }
        next[key] = kind;
      }
      return next;
    });
  }

  function toggleFrameSource(time: number) {
    const key = String(time);
    const candidate = candidates.find((c) => String(c.time) === key);
    if (!(candidate?.editedUrl || candidate?.editedAssetId)) return;
    setFrameSources((prev) => ({
      ...prev,
      [key]: prev[key] === "edited" ? "original" : "edited",
    }));
  }

  async function resolveCandidate(
    candidate: SpanClipFrameCandidate,
  ): Promise<{ assetId?: string; file?: File; previewUrl?: string | null }> {
    const key = String(candidate.time);
    const source = frameSources[key] ?? "original";
    const useEdited =
      source === "edited" &&
      Boolean(candidate.editedAssetId || candidate.editedUrl);

    if (useEdited) {
      if (candidate.editedAssetId) {
        return {
          assetId: candidate.editedAssetId,
          previewUrl: candidate.editedUrl,
        };
      }
      if (candidate.editedUrl) {
        return {
          file: await urlToFile(
            candidate.editedUrl,
            `edited-${formatVideoTime(candidate.time)}.jpg`,
          ),
          previewUrl: candidate.editedUrl,
        };
      }
    }

    if (candidate.frameAssetId) {
      return {
        assetId: candidate.frameAssetId,
        previewUrl: candidate.originalThumbUrl,
      };
    }
    if (candidate.originalThumbUrl) {
      return {
        file: await urlToFile(
          candidate.originalThumbUrl,
          `frame-${formatVideoTime(candidate.time)}.jpg`,
        ),
        previewUrl: candidate.originalThumbUrl,
      };
    }
    return {
      file: await captureFrameFile(candidate.time),
      previewUrl: null,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!waveSpeedConfigured || busy) return;
    if (selectedCandidates.length === 0) {
      setLocalError("Select at least one frame.");
      return;
    }

    setLocalError(null);
    setLocalSubmitting(true);

    const startedAt = Date.now();
    const trimmedPrompt = prompt.trim();
    const historyId = createWanVideoHistoryId();
    const durationValue = clampWanVideoDuration(duration);
    const seedValue = seed.trim();
    const timeSec = selectedCandidates[0]?.time ?? 0;

    try {
      const formData = new FormData();
      formData.set("prompt", trimmedPrompt);
      formData.set("duration", String(durationValue));
      formData.set("aspectRatio", aspectRatio);
      formData.set("resolution", resolution);
      if (seedValue) formData.set("seed", seedValue);
      if (enablePromptExpansion) formData.set("enablePromptExpansion", "1");
      formData.set("generateAudio", generateAudio ? "1" : "0");

      const historyFiles: File[] = [];
      for (const candidate of selectedCandidates) {
        const source = await resolveCandidate(candidate);
        if (source.assetId) {
          formData.append("referenceFrameAssetIds", source.assetId);
          const preview =
            source.previewUrl ??
            candidateDisplayUrl(
              candidate,
              frameSources[String(candidate.time)] ?? "original",
            );
          if (preview) {
            try {
              historyFiles.push(
                await urlToFile(
                  preview,
                  `ref-${formatVideoTime(candidate.time)}.jpg`,
                ),
              );
            } catch {
              // History thumbs are best-effort.
            }
          }
        } else if (source.file) {
          formData.append("referenceImages", source.file);
          historyFiles.push(source.file);
        }
      }

      const baseJob: Omit<WanClipJob, "predictionId" | "phase" | "status" | "progress"> = {
        spanId,
        spanLabel,
        prompt: trimmedPrompt,
        duration: durationValue,
        resolution,
        aspectRatio,
        seed: seedValue,
        generateAudio,
        enablePromptExpansion,
        apiProgress: null,
        error: null,
        outputUrl: null,
        startedAt,
        historyId,
        referenceImages: historyFiles,
        timeSec,
      };

      onJobAccepted({
        ...baseJob,
        predictionId: null,
        phase: "submitting",
        status: "uploading",
        progress: 6,
      });

      const submitted = await submitWanVideoAction(formData);
      if (submitted.error || !submitted.predictionId) {
        const message = submitted.error ?? "Submit failed.";
        setLocalError(message);
        onJobSubmitError(spanId, message);
        return;
      }

      onJobAccepted({
        ...baseJob,
        predictionId: submitted.predictionId,
        phase: "polling",
        status: submitted.status ?? "created",
        progress: estimateWanVideoProgressPercent({
          status: submitted.status ?? "created",
          startedAt,
          phase: "polling",
        }),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare frames for Wan video reference.";
      setLocalError(message);
      onJobSubmitError(spanId, message);
    } finally {
      setLocalSubmitting(false);
    }
  }

  const error = localError ?? job?.error ?? null;
  const durationChoices = wanVideoDurationChoices();
  const editedCount = candidates.filter(
    (c) => c.editedUrl || c.editedAssetId,
  ).length;
  const jobPhase = job?.phase ?? (localSubmitting ? "submitting" : "idle");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-x-3 top-[4vh] z-50 mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-lg outline-none sm:inset-x-auto">
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
                <Clapperboard className="size-4 shrink-0" />
                Wan clip · {spanLabel}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Wan 3.0 reference-to-video. Close anytime — the run keeps going on the span.
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
              {!waveSpeedConfigured ? (
                <Alert>
                  <AlertDescription>
                    Set <code className="text-xs">WAVESPEED_API_KEY</code> in{" "}
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
                      onClick={selectAll}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || editedCount === 0}
                      onClick={selectEditedOnly}
                    >
                      Edited only ({editedCount})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={selectOriginalsOnly}
                    >
                      Originals
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || selectedKeys.length === 0 || editedCount === 0}
                    onClick={() => setAllSources("edited")}
                  >
                    Selected → edited
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || selectedKeys.length === 0}
                    onClick={() => setAllSources("original")}
                  >
                    Selected → original
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Click a frame to include it. When an edit exists, use the badge to
                  switch between edited and original for that frame.
                </p>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {candidates.map((candidate) => {
                    const key = String(candidate.time);
                    const checked = selectedKeys.includes(key);
                    const hasEdited = Boolean(
                      candidate.editedUrl || candidate.editedAssetId,
                    );
                    const source =
                      frameSources[key] ?? (hasEdited ? "edited" : "original");
                    const displayUrl = candidateDisplayUrl(candidate, source);
                    return (
                      <li key={key} className="flex flex-col gap-1">
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
                          {displayUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={displayUrl}
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
                        {hasEdited ? (
                          <button
                            type="button"
                            disabled={busy || !checked}
                            onClick={() => toggleFrameSource(candidate.time)}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] ring-1 transition",
                              source === "edited"
                                ? "bg-foreground text-background ring-foreground"
                                : "bg-background text-muted-foreground ring-border",
                              (!checked || busy) && "opacity-50",
                            )}
                          >
                            {source === "edited" ? "Using edited" : "Using original"}
                          </button>
                        ) : (
                          <span className="px-1 text-[10px] text-muted-foreground">
                            Original
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="span-wan-prompt">Prompt</Label>
                <Textarea
                  id="span-wan-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={busy || !waveSpeedConfigured}
                  required
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="span-wan-duration">Duration (seconds)</Label>
                  <select
                    id="span-wan-duration"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={duration}
                    disabled={busy || !waveSpeedConfigured}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  >
                    {durationChoices.map((value) => (
                      <option key={value} value={value}>
                        {value}s
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="span-wan-aspect">Aspect ratio</Label>
                  <select
                    id="span-wan-aspect"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={aspectRatio}
                    disabled={busy || !waveSpeedConfigured}
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
                  <Label htmlFor="span-wan-resolution">Resolution</Label>
                  <select
                    id="span-wan-resolution"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={resolution}
                    disabled={busy || !waveSpeedConfigured}
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
                  <Label htmlFor="span-wan-seed">Seed (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="span-wan-seed"
                      type="number"
                      inputMode="numeric"
                      placeholder="random"
                      value={seed}
                      disabled={busy || !waveSpeedConfigured}
                      onChange={(event) => setSeed(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Generate random seed"
                      disabled={busy || !waveSpeedConfigured}
                      onClick={() => setSeed(String(randomWanSeed()))}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="span-wan-audio">Generate audio</Label>
                  <Switch
                    id="span-wan-audio"
                    checked={generateAudio}
                    disabled={busy || !waveSpeedConfigured}
                    onCheckedChange={setGenerateAudio}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="span-wan-expand">Enable prompt expansion</Label>
                  <Switch
                    id="span-wan-expand"
                    checked={enablePromptExpansion}
                    disabled={busy || !waveSpeedConfigured}
                    onCheckedChange={setEnablePromptExpansion}
                  />
                </div>
              </div>

              {busy || jobPhase === "completed" || jobPhase === "failed" ? (
                <WanClipProgressBar
                  progress={displayProgress}
                  status={job?.status ?? null}
                  phase={jobPhase === "idle" ? "submitting" : jobPhase}
                />
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {displayOutput ? (
                <div className="grid gap-3">
                  <video
                    key={displayOutput}
                    src={displayOutput}
                    controls
                    playsInline
                    className="w-full rounded-lg bg-black ring-1 ring-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Saved on this span — also listed under Generated clips below the frames.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    nativeButton={false}
                    render={
                      <a
                        href={displayOutput}
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
                {job?.status ? ` · ${job.status}` : ""}
                {job?.predictionId ? ` · ${job.predictionId.slice(0, 8)}…` : ""}
              </p>
              <div className="flex gap-2">
                {busy ? (
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Close · keep running
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !waveSpeedConfigured ||
                    !prompt.trim() ||
                    selectedCandidates.length === 0
                  }
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {job?.phase === "saving"
                        ? "Saving…"
                        : localSubmitting || job?.phase === "submitting"
                          ? "Uploading…"
                          : "Generating…"}
                    </>
                  ) : (
                    <>
                      <Clapperboard className="size-4" />
                      {job?.phase === "failed"
                        ? "Retry Wan clip"
                        : job?.phase === "completed"
                          ? "Generate another"
                          : "Generate Wan clip"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
