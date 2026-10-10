"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Clapperboard,
  Download,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Scissors,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatVideoTime } from "@/lib/video-frames";
import {
  clampWanVideoEditDuration,
  DEFAULT_WAN_VIDEO_EDIT_PROMPT,
  DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
  estimateWanVideoEditProgressPercent,
  MAX_WAN_VIDEO_EDIT_AUDIO_BYTES,
  MAX_WAN_VIDEO_EDIT_IMAGE_BYTES,
  MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS,
  MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES,
  randomWanSeed,
  suggestedWanVideoEditDuration,
  wanVideoEditDurationChoices,
  WAN_VIDEO_EDIT_INPUT_MAX_SEC,
  WAN_VIDEO_EDIT_RESOLUTIONS,
  type WanVideoEditResolution,
} from "@/lib/wan-video-edit";
import { createWanVideoEditHistoryId } from "@/lib/wan-video-edit-history";
import type { SpanClipFrameCandidate } from "@/components/admin/video-frame-krea-clip-dialog";
import { previewSpanCutAction } from "@/server/actions/video-frame-cut.actions";
import { submitWanVideoEditAction } from "@/server/actions/wan-video-edit.actions";

export type WanVideoEditJobPhase =
  | "submitting"
  | "polling"
  | "saving"
  | "completed"
  | "failed";

export interface WanVideoEditJob {
  spanId: string;
  spanLabel: string;
  prompt: string;
  duration: number | null;
  resolution: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  cutStartSec: number;
  cutEndSec: number;
  predictionId: string | null;
  phase: WanVideoEditJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  referenceImages: File[];
  referenceAudios: File[];
  timeSec: number;
  inferenceMs?: number;
}

export interface VideoFrameWanVideoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Full project source video URL for in-dialog cut preview. */
  videoUrl: string | null;
  spanId: string;
  spanLabel: string;
  cutStartSec: number;
  cutEndSec: number;
  /** Optional span stills — only shown after the user opens “Add from span”. */
  candidates?: SpanClipFrameCandidate[];
  waveSpeedConfigured: boolean;
  job?: WanVideoEditJob | null;
  onJobAccepted: (job: WanVideoEditJob) => void;
  onJobSubmitError: (spanId: string, error: string) => void;
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const IMAGE_ACCEPT_SET = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** In-session drafts so closing the dialog by accident does not wipe the form. */
interface WanVideoEditDialogDraft {
  prompt: string;
  duration: number | "auto";
  resolution: WanVideoEditResolution;
  seed: string;
  enablePromptExpansion: boolean;
  generateAudio: boolean;
  referenceImageFiles: File[];
  spanAssetIds: string[];
  showSpanPicker: boolean;
  audioFiles: File[];
  cutPreviewPath: string | null;
}

const wanVideoEditDialogDrafts = new Map<string, WanVideoEditDialogDraft>();

function wanVideoEditDialogDraftKey(projectId: string, spanId: string): string {
  return `${projectId}:${spanId}`;
}

function getWanVideoEditDialogDraft(
  projectId: string,
  spanId: string,
): WanVideoEditDialogDraft | null {
  return wanVideoEditDialogDrafts.get(wanVideoEditDialogDraftKey(projectId, spanId)) ?? null;
}

function setWanVideoEditDialogDraft(
  projectId: string,
  spanId: string,
  draft: WanVideoEditDialogDraft,
): void {
  wanVideoEditDialogDrafts.set(wanVideoEditDialogDraftKey(projectId, spanId), draft);
}

function clearWanVideoEditDialogDraft(projectId: string, spanId: string): void {
  wanVideoEditDialogDrafts.delete(wanVideoEditDialogDraftKey(projectId, spanId));
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

function ProgressBar({
  progress,
  status,
  phase,
}: {
  progress: number;
  status: string | null;
  phase: WanVideoEditJobPhase | "idle";
}) {
  const label =
    phase === "submitting"
      ? "Cutting & uploading…"
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

export function VideoFrameWanVideoEditDialog({
  open,
  onOpenChange,
  projectId,
  videoUrl,
  spanId,
  spanLabel,
  cutStartSec,
  cutEndSec,
  candidates = [],
  waveSpeedConfigured,
  job,
  onJobAccepted,
  onJobSubmitError,
}: VideoFrameWanVideoEditDialogProps) {
  const [prompt, setPrompt] = useState(DEFAULT_WAN_VIDEO_EDIT_PROMPT);
  const [duration, setDuration] = useState<number | "auto">(() =>
    suggestedWanVideoEditDuration(cutStartSec, cutEndSec),
  );
  const [resolution, setResolution] = useState<WanVideoEditResolution>(
    DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
  );
  const [seed, setSeed] = useState("");
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [spanAssetIds, setSpanAssetIds] = useState<string[]>([]);
  const [showSpanPicker, setShowSpanPicker] = useState(false);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cutPreviewPath, setCutPreviewPath] = useState<string | null>(null);
  const [cutPreviewLoading, setCutPreviewLoading] = useState(false);
  const [cutPreviewError, setCutPreviewError] = useState<string | null>(null);
  const [rangePlaying, setRangePlaying] = useState(false);
  const [refDragging, setRefDragging] = useState(false);
  /** Gate draft writes until open/restore has applied initial form state. */
  const [draftReady, setDraftReady] = useState(false);
  const sourcePreviewRef = useRef<HTMLVideoElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const refPreviewUrls = useMemo(
    () => referenceImageFiles.map((file) => URL.createObjectURL(file)),
    [referenceImageFiles],
  );

  useEffect(() => {
    return () => {
      for (const url of refPreviewUrls) URL.revokeObjectURL(url);
    };
  }, [refPreviewUrls]);

  const totalRefCount = referenceImageFiles.length + spanAssetIds.length;

  const cutLength = Math.max(0, cutEndSec - cutStartSec);
  const cutTooLong = cutLength > WAN_VIDEO_EDIT_INPUT_MAX_SEC + 0.05;

  const busy =
    localSubmitting ||
    job?.phase === "submitting" ||
    job?.phase === "polling" ||
    job?.phase === "saving";

  const displayOutput = job?.outputUrl ?? null;
  const displayProgress =
    job != null
      ? estimateWanVideoEditProgressPercent({
          status: job.status,
          startedAt: job.startedAt,
          apiProgress: job.apiProgress,
          phase: job.phase,
        })
      : localSubmitting
        ? 8
        : 0;

  useEffect(() => {
    if (!open) {
      setDraftReady(false);
      return;
    }

    setDraftReady(false);

    if (
      job &&
      (job.phase === "polling" ||
        job.phase === "submitting" ||
        job.phase === "saving")
    ) {
      setPrompt(job.prompt || DEFAULT_WAN_VIDEO_EDIT_PROMPT);
      setDuration(job.duration == null ? "auto" : job.duration);
      setResolution(
        (job.resolution as WanVideoEditResolution) ||
          DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
      );
      setSeed(job.seed);
      setGenerateAudio(job.generateAudio);
      setEnablePromptExpansion(job.enablePromptExpansion);
      setLocalError(job.error);
      setLocalSubmitting(false);
      setDraftReady(true);
      return;
    }
    if (job?.phase === "failed" || job?.phase === "completed") {
      setPrompt(job.prompt || DEFAULT_WAN_VIDEO_EDIT_PROMPT);
      setDuration(job.duration == null ? "auto" : job.duration);
      setResolution(
        (job.resolution as WanVideoEditResolution) ||
          DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
      );
      setSeed(job.seed);
      setGenerateAudio(job.generateAudio);
      setEnablePromptExpansion(job.enablePromptExpansion);
      setLocalError(job.error);
      setLocalSubmitting(false);
      setDraftReady(true);
      return;
    }

    const draft = getWanVideoEditDialogDraft(projectId, spanId);
    if (draft) {
      setPrompt(draft.prompt);
      setDuration(draft.duration);
      setResolution(draft.resolution);
      setSeed(draft.seed);
      setEnablePromptExpansion(draft.enablePromptExpansion);
      setGenerateAudio(draft.generateAudio);
      setReferenceImageFiles(draft.referenceImageFiles);
      setSpanAssetIds(draft.spanAssetIds);
      setShowSpanPicker(draft.showSpanPicker);
      setAudioFiles(draft.audioFiles);
      setCutPreviewPath(draft.cutPreviewPath);
      setLocalSubmitting(false);
      setLocalError(null);
      setCutPreviewError(null);
      setRangePlaying(false);
      setRefDragging(false);
      setDraftReady(true);
      return;
    }

    setPrompt(DEFAULT_WAN_VIDEO_EDIT_PROMPT);
    setDuration(suggestedWanVideoEditDuration(cutStartSec, cutEndSec));
    setResolution(DEFAULT_WAN_VIDEO_EDIT_RESOLUTION);
    setSeed("");
    setEnablePromptExpansion(false);
    setGenerateAudio(true);
    setReferenceImageFiles([]);
    setSpanAssetIds([]);
    setShowSpanPicker(false);
    setAudioFiles([]);
    setLocalSubmitting(false);
    setLocalError(null);
    setCutPreviewPath(null);
    setCutPreviewError(null);
    setRangePlaying(false);
    setRefDragging(false);
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, spanId, projectId, cutStartSec, cutEndSec, job?.phase, job?.predictionId, job?.prompt, job?.error]);

  useEffect(() => {
    if (!open || !draftReady) return;
    // Skip overwriting a restored draft while a background job owns the form.
    if (
      job &&
      (job.phase === "polling" ||
        job.phase === "submitting" ||
        job.phase === "saving" ||
        job.phase === "completed" ||
        job.phase === "failed")
    ) {
      return;
    }
    setWanVideoEditDialogDraft(projectId, spanId, {
      prompt,
      duration,
      resolution,
      seed,
      enablePromptExpansion,
      generateAudio,
      referenceImageFiles,
      spanAssetIds,
      showSpanPicker,
      audioFiles,
      cutPreviewPath,
    });
  }, [
    open,
    draftReady,
    projectId,
    spanId,
    prompt,
    duration,
    resolution,
    seed,
    enablePromptExpansion,
    generateAudio,
    referenceImageFiles,
    spanAssetIds,
    showSpanPicker,
    audioFiles,
    cutPreviewPath,
    job,
  ]);

  useEffect(() => {
    if (!rangePlaying) return;
    const video = sourcePreviewRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.currentTime >= cutEndSec - 0.04) {
        video.pause();
        video.currentTime = cutStartSec;
        setRangePlaying(false);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [rangePlaying, cutStartSec, cutEndSec]);

  async function playSourceCut() {
    const video = sourcePreviewRef.current;
    if (!video || !videoUrl) return;
    try {
      video.currentTime = cutStartSec;
      await video.play();
      setRangePlaying(true);
      setCutPreviewError(null);
    } catch (err) {
      setCutPreviewError(
        err instanceof Error ? err.message : "Could not play source cut.",
      );
      setRangePlaying(false);
    }
  }

  async function renderExactCutPreview() {
    if (cutTooLong || cutPreviewLoading) return;
    setCutPreviewLoading(true);
    setCutPreviewError(null);
    try {
      const result = await previewSpanCutAction({
        projectId,
        startSec: cutStartSec,
        endSec: cutEndSec,
      });
      if (result.error || !result.path) {
        setCutPreviewPath(null);
        setCutPreviewError(result.error ?? "Could not render cut preview.");
        return;
      }
      setCutPreviewPath(result.path);
    } catch (err) {
      setCutPreviewPath(null);
      setCutPreviewError(
        err instanceof Error ? err.message : "Could not render cut preview.",
      );
    } finally {
      setCutPreviewLoading(false);
    }
  }

  function addReferenceImageFiles(candidatesList: FileList | File[] | null) {
    if (!candidatesList || candidatesList.length === 0) return;
    setLocalError(null);
    const next = [...referenceImageFiles];
    for (const file of Array.from(candidatesList)) {
      if (next.length + spanAssetIds.length >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES) {
        setLocalError(
          `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES} reference images.`,
        );
        break;
      }
      if (!IMAGE_ACCEPT_SET.has(file.type)) {
        setLocalError("Use JPEG, PNG, WebP, or GIF images.");
        continue;
      }
      if (file.size > MAX_WAN_VIDEO_EDIT_IMAGE_BYTES) {
        setLocalError(
          `Images must be ${Math.round(MAX_WAN_VIDEO_EDIT_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
        );
        continue;
      }
      next.push(file);
    }
    setReferenceImageFiles(next);
    if (refInputRef.current) refInputRef.current.value = "";
  }

  function toggleSpanAsset(candidate: SpanClipFrameCandidate) {
    const assetId = candidate.editedAssetId ?? candidate.frameAssetId;
    if (!assetId) {
      setLocalError(
        `No saved asset for ${formatVideoTime(candidate.time)} — extract frames or upload an image.`,
      );
      return;
    }
    setSpanAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      if (referenceImageFiles.length + prev.length >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES) {
        setLocalError(
          `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES} reference images.`,
        );
        return prev;
      }
      setLocalError(null);
      return [...prev, assetId];
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!waveSpeedConfigured || busy || cutTooLong) return;

    setLocalError(null);
    setLocalSubmitting(true);

    const startedAt = Date.now();
    const trimmedPrompt = prompt.trim();
    const historyId = createWanVideoEditHistoryId();
    const durationValue =
      duration === "auto" ? null : clampWanVideoEditDuration(duration);
    const seedValue = seed.trim();

    try {
      const formData = new FormData();
      formData.set("prompt", trimmedPrompt);
      formData.set(
        "duration",
        durationValue == null ? "auto" : String(durationValue),
      );
      formData.set("resolution", resolution);
      if (seedValue) formData.set("seed", seedValue);
      if (enablePromptExpansion) formData.set("enablePromptExpansion", "1");
      formData.set("generateAudio", generateAudio ? "1" : "0");
      formData.set("projectId", projectId);
      formData.set("cutStartSec", String(cutStartSec));
      formData.set("cutEndSec", String(cutEndSec));

      for (const file of referenceImageFiles) {
        formData.append("referenceImages", file);
      }
      for (const assetId of spanAssetIds) {
        formData.append("referenceFrameAssetIds", assetId);
      }
      for (const file of audioFiles) {
        formData.append("referenceAudios", file);
      }

      const historyFiles: File[] = [...referenceImageFiles];
      for (const assetId of spanAssetIds) {
        const candidate = candidates.find(
          (c) => c.editedAssetId === assetId || c.frameAssetId === assetId,
        );
        const preview =
          candidate?.editedUrl ??
          candidate?.originalThumbUrl ??
          candidate?.thumbUrl;
        if (!preview) continue;
        try {
          historyFiles.push(
            await urlToFile(
              preview,
              `ref-${formatVideoTime(candidate?.time ?? 0)}.jpg`,
            ),
          );
        } catch {
          // History thumbs are best-effort.
        }
      }

      const baseJob: Omit<
        WanVideoEditJob,
        "predictionId" | "phase" | "status" | "progress"
      > = {
        spanId,
        spanLabel,
        prompt: trimmedPrompt,
        duration: durationValue,
        resolution,
        seed: seedValue,
        generateAudio,
        enablePromptExpansion,
        cutStartSec,
        cutEndSec,
        apiProgress: null,
        error: null,
        outputUrl: null,
        startedAt,
        historyId,
        referenceImages: historyFiles,
        referenceAudios: [...audioFiles],
        timeSec: cutStartSec,
      };

      onJobAccepted({
        ...baseJob,
        predictionId: null,
        phase: "submitting",
        status: "cutting",
        progress: 8,
      });
      clearWanVideoEditDialogDraft(projectId, spanId);

      const submitted = await submitWanVideoEditAction(formData);
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
        progress: estimateWanVideoEditProgressPercent({
          status: submitted.status ?? "created",
          startedAt,
          phase: "polling",
        }),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start Wan video edit.";
      setLocalError(message);
      onJobSubmitError(spanId, message);
    } finally {
      setLocalSubmitting(false);
    }
  }

  const error = localError ?? job?.error ?? null;
  const durationChoices = wanVideoEditDurationChoices();
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
                Wan video edit · {spanLabel}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Cuts {formatVideoTime(cutStartSec)} – {formatVideoTime(cutEndSec)}{" "}
                ({cutLength.toFixed(1)}s) from the source, then runs Wan 3.0 video-edit.
                Close anytime — your form is kept for this span, and runs continue in the
                background.
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

              {cutTooLong ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    This span is {cutLength.toFixed(1)}s. Wan video edit accepts at
                    most {WAN_VIDEO_EDIT_INPUT_MAX_SEC}s of input video.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-3 rounded-xl border bg-muted/15 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Source cut</p>
                    <p className="text-xs text-muted-foreground">
                      First→last frame · {formatVideoTime(cutStartSec)} –{" "}
                      {formatVideoTime(cutEndSec)} · {cutLength.toFixed(1)}s
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !videoUrl || cutTooLong}
                      onClick={() => void playSourceCut()}
                    >
                      <Play className="size-3.5" />
                      {rangePlaying ? "Playing…" : "Play range"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || cutTooLong || cutPreviewLoading}
                      onClick={() => void renderExactCutPreview()}
                    >
                      {cutPreviewLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Scissors className="size-3.5" />
                      )}
                      {cutPreviewPath ? "Re-render cut" : "Render exact cut"}
                    </Button>
                  </div>
                </div>

                {videoUrl ? (
                  <video
                    ref={sourcePreviewRef}
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-56 w-full rounded-lg bg-black object-contain ring-1 ring-border"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (Number.isFinite(cutStartSec)) {
                        video.currentTime = cutStartSec;
                      }
                    }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Source video is not available for preview.
                  </p>
                )}

                {cutPreviewPath ? (
                  <div className="grid gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Exact ffmpeg cut (same input Wan video edit receives)
                    </p>
                    <video
                      key={cutPreviewPath}
                      src={cutPreviewPath}
                      controls
                      playsInline
                      className="max-h-56 w-full rounded-lg bg-black object-contain ring-1 ring-border"
                    />
                  </div>
                ) : null}

                {cutPreviewError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{cutPreviewError}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>
                  Reference images{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional · up to {MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES})
                  </span>
                </Label>
                <input
                  ref={refInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="sr-only"
                  disabled={busy || !waveSpeedConfigured}
                  onChange={(event) =>
                    addReferenceImageFiles(event.target.files)
                  }
                />

                {totalRefCount === 0 && !showSpanPicker ? (
                  <button
                    type="button"
                    disabled={busy || !waveSpeedConfigured}
                    onClick={() => refInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!busy) setRefDragging(true);
                    }}
                    onDragLeave={() => setRefDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setRefDragging(false);
                      if (!busy) addReferenceImageFiles(event.dataTransfer.files);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition",
                      refDragging
                        ? "border-foreground bg-muted/40"
                        : "border-border bg-muted/10 hover:border-foreground/40 hover:bg-muted/20",
                      (busy || !waveSpeedConfigured) && "opacity-60",
                    )}
                  >
                    <Upload className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Upload reference images
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Drag & drop or click · JPEG, PNG, WebP, GIF
                    </span>
                  </button>
                ) : null}

                {referenceImageFiles.length > 0 ? (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {referenceImageFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={refPreviewUrls[index]}
                          alt=""
                          className="aspect-square w-full rounded-lg object-cover ring-1 ring-border"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-xs"
                          className="absolute top-1 right-1"
                          disabled={busy}
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setReferenceImageFiles((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {spanAssetIds.length > 0 ? (
                  <ul className="grid gap-1.5">
                    {spanAssetIds.map((assetId) => {
                      const candidate = candidates.find(
                        (c) =>
                          c.editedAssetId === assetId ||
                          c.frameAssetId === assetId,
                      );
                      return (
                        <li
                          key={assetId}
                          className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs"
                        >
                          <span className="truncate">
                            Span frame ·{" "}
                            {candidate
                              ? `${candidate.label} ${formatVideoTime(candidate.time)}`
                              : assetId.slice(0, 8)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={busy}
                            onClick={() =>
                              setSpanAssetIds((prev) =>
                                prev.filter((id) => id !== assetId),
                              )
                            }
                          >
                            <X className="size-3" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  {totalRefCount > 0 || showSpanPicker ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        busy ||
                        !waveSpeedConfigured ||
                        totalRefCount >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES
                      }
                      onClick={() => refInputRef.current?.click()}
                    >
                      <Plus className="size-3.5" />
                      Upload images
                    </Button>
                  ) : null}
                  {candidates.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy || !waveSpeedConfigured}
                      onClick={() => setShowSpanPicker((prev) => !prev)}
                    >
                      {showSpanPicker ? "Hide span frames" : "Add from span"}
                    </Button>
                  ) : null}
                  {totalRefCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setReferenceImageFiles([]);
                        setSpanAssetIds([]);
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>

                {showSpanPicker ? (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {candidates.map((candidate) => {
                      const assetId =
                        candidate.editedAssetId ?? candidate.frameAssetId;
                      const checked = assetId
                        ? spanAssetIds.includes(assetId)
                        : false;
                      const displayUrl =
                        candidate.editedUrl ??
                        candidate.originalThumbUrl ??
                        candidate.thumbUrl;
                      return (
                        <li key={String(candidate.time)}>
                          <button
                            type="button"
                            disabled={busy || !assetId}
                            onClick={() => toggleSpanAsset(candidate)}
                            className={cn(
                              "relative flex w-full flex-col overflow-hidden rounded-lg ring-1 transition",
                              checked
                                ? "ring-foreground"
                                : "ring-border hover:ring-foreground/40",
                              (!assetId || busy) && "opacity-50",
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
                              <div className="flex aspect-[9/16] items-center justify-center bg-muted text-xs text-muted-foreground">
                                …
                              </div>
                            )}
                            <span className="px-1.5 py-1 text-[10px] text-muted-foreground">
                              {candidate.label} · {formatVideoTime(candidate.time)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="span-wan-edit-prompt">Prompt</Label>
                <Textarea
                  id="span-wan-edit-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={busy || !waveSpeedConfigured}
                  required
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="span-wan-edit-duration">Duration</Label>
                  <select
                    id="span-wan-edit-duration"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={duration === "auto" ? "auto" : String(duration)}
                    disabled={busy || !waveSpeedConfigured}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDuration(value === "auto" ? "auto" : Number(value));
                    }}
                  >
                    <option value="auto">Auto (match cut)</option>
                    {durationChoices.map((value) => (
                      <option key={value} value={value}>
                        {value}s
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="span-wan-edit-resolution">Resolution</Label>
                  <select
                    id="span-wan-edit-resolution"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={resolution}
                    disabled={busy || !waveSpeedConfigured}
                    onChange={(event) =>
                      setResolution(event.target.value as WanVideoEditResolution)
                    }
                  >
                    {WAN_VIDEO_EDIT_RESOLUTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="span-wan-edit-seed">Seed (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="span-wan-edit-seed"
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

              <div className="grid gap-2">
                <Label htmlFor="span-wan-edit-audio-files">
                  Reference audio (optional · max {MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS})
                </Label>
                <Input
                  id="span-wan-edit-audio-files"
                  type="file"
                  accept="audio/*"
                  multiple
                  disabled={busy || !waveSpeedConfigured}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []).filter(
                      (file) =>
                        file.type.startsWith("audio/") &&
                        file.size <= MAX_WAN_VIDEO_EDIT_AUDIO_BYTES,
                    );
                    setAudioFiles(
                      files.slice(0, MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS),
                    );
                  }}
                />
                {audioFiles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {audioFiles.map((f) => f.name).join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="span-wan-edit-audio">Generate audio</Label>
                  <Switch
                    id="span-wan-edit-audio"
                    checked={generateAudio}
                    disabled={busy || !waveSpeedConfigured}
                    onCheckedChange={setGenerateAudio}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="span-wan-edit-expand">
                    Enable prompt expansion
                  </Label>
                  <Switch
                    id="span-wan-edit-expand"
                    checked={enablePromptExpansion}
                    disabled={busy || !waveSpeedConfigured}
                    onCheckedChange={setEnablePromptExpansion}
                  />
                </div>
              </div>

              {busy || jobPhase === "completed" || jobPhase === "failed" ? (
                <ProgressBar
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
                    Saved on this span under Generated clips.
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
                {totalRefCount > 0
                  ? `${totalRefCount} ref image${totalRefCount === 1 ? "" : "s"}`
                  : "No reference images"}
                {audioFiles.length > 0
                  ? ` · ${audioFiles.length} audio`
                  : ""}
                {job?.status ? ` · ${job.status}` : ""}
              </p>
              <div className="flex gap-2">
                {busy ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Close · keep running
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !waveSpeedConfigured ||
                    !prompt.trim() ||
                    cutTooLong
                  }
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {job?.phase === "saving"
                        ? "Saving…"
                        : localSubmitting || job?.phase === "submitting"
                          ? "Cutting…"
                          : "Editing…"}
                    </>
                  ) : (
                    <>
                      <Clapperboard className="size-4" />
                      {job?.phase === "failed"
                        ? "Retry Wan video edit"
                        : job?.phase === "completed"
                          ? "Edit again"
                          : "Wan video edit"}
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
