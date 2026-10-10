"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WanCostEstimate } from "@/components/admin/wan-cost-estimate";
import { WanReferenceImagesPicker } from "@/components/admin/wan-reference-images-picker";
import { formatVideoTime } from "@/lib/video-frames";
import {
  DEFAULT_WAN_SIZE,
  estimateWanProgressPercent,
  randomWanSeed,
  WAN_SIZE_PRESETS,
} from "@/lib/wan-image-edit";
import { createWanHistoryId } from "@/lib/wan-image-edit-history";
import { submitWanImageEditAction } from "@/server/actions/wan-image-edit.actions";

export type WanFrameJobPhase =
  | "submitting"
  | "polling"
  | "saving"
  | "completed"
  | "failed";

export interface WanFrameJob {
  time: number;
  label: string;
  prompt: string;
  predictionId: string | null;
  phase: WanFrameJobPhase;
  status: string | null;
  /** Last API-reported progress 0–100, if any. */
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  /** Shared with Wan image edit IndexedDB history. */
  historyId: string;
  size: string;
  seed: string;
  mainImage: File | null;
  referenceImages: File[];
  inferenceMs?: number;
  /** WaveSpeed USD charge when known. */
  costUsd?: number | null;
}

export interface VideoFrameWanEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  time: number;
  label: string;
  /** Full-resolution source frame (object URL or server path). */
  imageUrl: string;
  /** Blob for WaveSpeed upload when available (preferred over re-fetching). */
  imageBlob?: Blob | null;
  existingEditUrl?: string | null;
  /** In-flight or finished background job for this frame (survives dialog close). */
  job?: WanFrameJob | null;
  waveSpeedConfigured: boolean;
  /** Called after WaveSpeed accepts the job — parent owns polling/save. */
  onJobAccepted: (job: WanFrameJob) => void;
  onJobSubmitError: (time: number, error: string) => void;
}

function WanProgressBar({
  progress,
  status,
  phase,
}: {
  progress: number;
  status: string | null;
  phase: WanFrameJobPhase;
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
    </div>
  );
}

export function VideoFrameWanEditDialog({
  open,
  onOpenChange,
  time,
  label,
  imageUrl,
  imageBlob,
  existingEditUrl,
  job,
  waveSpeedConfigured,
  onJobAccepted,
  onJobSubmitError,
}: VideoFrameWanEditDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<string>(DEFAULT_WAN_SIZE);
  const [seed, setSeed] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy =
    localSubmitting ||
    job?.phase === "submitting" ||
    job?.phase === "polling" ||
    job?.phase === "saving";

  const displayOutput = job?.outputUrl ?? existingEditUrl ?? null;
  const displayProgress =
    job != null
      ? estimateWanProgressPercent({
          status: job.status,
          startedAt: job.startedAt,
          apiProgress: job.apiProgress,
          phase: job.phase,
        })
      : localSubmitting
        ? 4
        : 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    // Keep prompt when reopening an in-flight job; otherwise reset form.
    if (job && (job.phase === "polling" || job.phase === "submitting" || job.phase === "saving")) {
      setPrompt(job.prompt || "");
      setLocalError(job.error);
      setLocalSubmitting(false);
      return;
    }
    if (job?.phase === "failed") {
      setPrompt(job.prompt || "");
      setLocalError(job.error);
      setLocalSubmitting(false);
      return;
    }
    if (job?.phase === "completed") {
      setPrompt(job.prompt || "");
      setLocalError(null);
      setLocalSubmitting(false);
      return;
    }
    setPrompt("");
    setSize(DEFAULT_WAN_SIZE);
    setSeed("");
    setReferenceImages([]);
    setLocalSubmitting(false);
    setLocalError(null);
  }, [open, time, job?.phase, job?.predictionId, job?.prompt, job?.error]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!waveSpeedConfigured || busy) {
      return;
    }
    setLocalError(null);
    setLocalSubmitting(true);

    const startedAt = Date.now();
    const trimmedPrompt = prompt.trim();
    const historyId = createWanHistoryId();
    const seedValue = seed.trim();
    const refs = [...referenceImages];

    try {
      let file: File;
      if (imageBlob && imageBlob.size > 0) {
        file = new File([imageBlob], `frame-${formatVideoTime(time)}.jpg`, {
          type: imageBlob.type || "image/jpeg",
        });
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error("Could not load the source frame.");
        }
        const blob = await response.blob();
        file = new File([blob], `frame-${formatVideoTime(time)}.jpg`, {
          type: blob.type || "image/jpeg",
        });
      }

      const formData = new FormData();
      formData.set("prompt", trimmedPrompt);
      formData.set("size", size);
      if (seedValue) {
        formData.set("seed", seedValue);
      }
      formData.set("image", file);
      for (const reference of refs) {
        formData.append("referenceImages", reference);
      }

      const baseJob = {
        time,
        label,
        prompt: trimmedPrompt,
        historyId,
        size,
        seed: seedValue,
        mainImage: file,
        referenceImages: refs,
        apiProgress: null as number | null,
        error: null as string | null,
        outputUrl: null as string | null,
        startedAt,
      };

      onJobAccepted({
        ...baseJob,
        predictionId: null,
        phase: "submitting",
        status: "uploading",
        progress: 4,
      });

      const submitted = await submitWanImageEditAction(formData);
      if (submitted.error || !submitted.predictionId) {
        const message = submitted.error ?? "Submit failed.";
        setLocalError(message);
        onJobSubmitError(time, message);
        return;
      }

      onJobAccepted({
        ...baseJob,
        predictionId: submitted.predictionId,
        phase: "polling",
        status: submitted.status ?? "created",
        progress: estimateWanProgressPercent({
          status: submitted.status ?? "created",
          startedAt,
          phase: "polling",
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submit failed.";
      setLocalError(message);
      onJobSubmitError(time, message);
    } finally {
      setLocalSubmitting(false);
    }
  }

  const error = localError ?? job?.error ?? null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(92vh,56rem)] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-lg ring-1 ring-foreground/10 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-medium">
                {label} · Wan edit
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {formatVideoTime(time)} · saved to Wan generation history when done
              </Dialog.Description>
            </div>
            <Dialog.Close render={<Button type="button" variant="ghost" size="icon-sm" />}>
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border">
                  <p className="border-b px-2 py-1 text-[11px] text-muted-foreground">Original</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Original frame"
                    className="mx-auto max-h-[min(50vh,28rem)] w-auto object-contain"
                  />
                </div>
                <div className="overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border">
                  <p className="border-b px-2 py-1 text-[11px] text-muted-foreground">Edited</p>
                  {displayOutput ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayOutput}
                      alt="Edited frame"
                      className="mx-auto max-h-[min(50vh,28rem)] w-auto object-contain"
                    />
                  ) : (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 text-xs text-muted-foreground">
                      {busy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <div className="w-full max-w-xs">
                            <WanProgressBar
                              progress={displayProgress}
                              status={job?.status ?? null}
                              phase={job?.phase ?? "submitting"}
                            />
                          </div>
                        </>
                      ) : (
                        "Run Wan edit to generate a result"
                      )}
                    </div>
                  )}
                </div>
              </div>
              {job && (job.phase === "polling" || job.phase === "saving") && displayOutput == null ? (
                <WanProgressBar
                  progress={displayProgress}
                  status={job.status}
                  phase={job.phase}
                />
              ) : null}
            </div>

            <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
              {!waveSpeedConfigured ? (
                <Alert>
                  <AlertDescription>
                    Set <code className="text-xs">WAVESPEED_API_KEY</code> to enable Wan edits.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="frame-wan-prompt">Prompt</Label>
                <Textarea
                  id="frame-wan-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={busy || !waveSpeedConfigured}
                  required
                  rows={5}
                  placeholder="Replace the product in Figure 1 with the one from Figure 2. Keep lighting and pose."
                />
                <p className="text-[11px] text-muted-foreground">
                  Frame is Figure 1. Refer to references as Figure 2, Figure 3, …
                </p>
              </div>

              <WanReferenceImagesPicker
                files={referenceImages}
                onChange={setReferenceImages}
                disabled={busy || !waveSpeedConfigured}
                compact
              />

              <div className="grid gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="frame-wan-size">Size</Label>
                  <select
                    id="frame-wan-size"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={size}
                    disabled={busy || !waveSpeedConfigured}
                    onChange={(event) => setSize(event.target.value)}
                  >
                    {WAN_SIZE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="frame-wan-seed">Seed (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="frame-wan-seed"
                      type="number"
                      value={seed}
                      disabled={busy || !waveSpeedConfigured}
                      onChange={(event) => setSeed(event.target.value)}
                      placeholder="-1 for random"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={busy || !waveSpeedConfigured}
                      aria-label="Random seed"
                      onClick={() => setSeed(String(randomWanSeed()))}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <WanCostEstimate
                enabled={waveSpeedConfigured && !busy}
                input={{ kind: "image-edit", size }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  disabled={busy || !waveSpeedConfigured || !prompt.trim()}
                  className="gap-1.5"
                >
                  {busy && job?.phase !== "completed" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {localSubmitting || job?.phase === "submitting"
                    ? "Uploading…"
                    : job?.phase === "polling"
                      ? "Running in background…"
                      : job?.phase === "saving"
                        ? "Saving…"
                        : "Run Wan edit"}
                </Button>
                {job?.status ? (
                  <Badge
                    variant={
                      job.phase === "completed"
                        ? "default"
                        : job.phase === "failed"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {job.status}
                  </Badge>
                ) : null}
                {job?.predictionId ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {job.predictionId.slice(0, 12)}…
                  </Badge>
                ) : null}
              </div>

              {busy ? (
                <WanProgressBar
                  progress={displayProgress}
                  status={job?.status ?? null}
                  phase={job?.phase ?? "submitting"}
                />
              ) : null}

              {job?.phase === "completed" && displayOutput ? (
                <p className="text-xs text-muted-foreground">
                  Saved under this frame in Export preview. You can close anytime.
                </p>
              ) : null}

              {busy ? (
                <p className="text-[11px] text-muted-foreground">
                  Closing this dialog keeps the job running. Progress shows on the export preview
                  thumb.
                </p>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {busy ? "Close (keep running)" : "Close"}
              </Button>
            </form>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
