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
  clampWanVideoEditDuration,
  DEFAULT_WAN_VIDEO_EDIT_PROMPT,
  DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
  estimateWanVideoEditProgressPercent,
  isWanCompleted,
  isWanTerminalFailure,
  MAX_WAN_VIDEO_EDIT_AUDIO_BYTES,
  MAX_WAN_VIDEO_EDIT_IMAGE_BYTES,
  MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS,
  MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES,
  MAX_WAN_VIDEO_EDIT_VIDEO_BYTES,
  randomWanSeed,
  wanVideoEditDurationChoices,
  WAN_VIDEO_EDIT_RESOLUTIONS,
  type WanVideoEditResolution,
} from "@/lib/wan-video-edit";
import {
  createWanVideoEditHistoryId,
  deleteWanVideoEditHistoryEntry,
  fileToWanVideoEditStoredBlob,
  formatWanVideoEditHistoryTime,
  listWanVideoEditHistory,
  saveWanVideoEditHistoryEntry,
  truncateWanVideoEditPrompt,
  wanVideoEditStoredBlobToFile,
  type WanVideoEditHistoryEntry,
} from "@/lib/wan-video-edit-history";
import {
  pollWanVideoEditAction,
  submitWanVideoEditAction,
} from "@/server/actions/wan-video-edit.actions";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const IMAGE_ACCEPT_SET = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-m4v";
const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm";
const POLL_INTERVAL_MS = 2500;

type JobPhase = "idle" | "submitting" | "polling" | "completed" | "failed";

function validateImageFile(candidate: File): string | null {
  if (!IMAGE_ACCEPT_SET.has(candidate.type)) {
    return "Use a JPEG, PNG, WebP, or GIF.";
  }
  if (candidate.size > MAX_WAN_VIDEO_EDIT_IMAGE_BYTES) {
    return `Image must be ${Math.round(MAX_WAN_VIDEO_EDIT_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}

function validateVideoFile(candidate: File): string | null {
  if (!candidate.type.startsWith("video/") && !VIDEO_ACCEPT.includes(candidate.type)) {
    return "Use an MP4, MOV, or WebM video.";
  }
  if (candidate.size > MAX_WAN_VIDEO_EDIT_VIDEO_BYTES) {
    return `Video must be ${Math.round(MAX_WAN_VIDEO_EDIT_VIDEO_BYTES / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}

function validateAudioFile(candidate: File): string | null {
  if (!candidate.type.startsWith("audio/")) {
    return "Use an MP3, WAV, AAC, or OGG audio file.";
  }
  if (candidate.size > MAX_WAN_VIDEO_EDIT_AUDIO_BYTES) {
    return `Audio must be ${Math.round(MAX_WAN_VIDEO_EDIT_AUDIO_BYTES / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}

function WanVideoEditHistoryThumb({ entry }: { entry: WanVideoEditHistoryEntry }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const outputUrl = entry.outputs[0] ?? null;
  const previewBlob =
    entry.sourceVideo?.blob ?? entry.referenceImages[0]?.blob ?? null;

  useEffect(() => {
    if (outputUrl || !previewBlob) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputUrl, previewBlob]);

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
    if (entry.sourceVideo) {
      return (
        <video
          src={blobUrl}
          muted
          playsInline
          preload="metadata"
          className="size-12 shrink-0 rounded-md object-cover ring-1 ring-border"
        />
      );
    }
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

interface WanVideoEditPanelProps {
  configured: boolean;
}

export function WanVideoEditPanel({ configured }: WanVideoEditPanelProps) {
  const [prompt, setPrompt] = useState(DEFAULT_WAN_VIDEO_EDIT_PROMPT);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referenceFrames, setReferenceFrames] = useState<PickedKreaFrame[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<File[]>([]);
  const [duration, setDuration] = useState<number | "auto">("auto");
  const [resolution, setResolution] = useState<WanVideoEditResolution>(
    DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
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
  const videoInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputId = useId();
  const refInputId = useId();
  const audioInputId = useId();
  const [refError, setRefError] = useState<string | null>(null);
  const [refPreviewUrls, setRefPreviewUrls] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<WanVideoEditHistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const historyIdRef = useRef(createWanVideoEditHistoryId());
  const historyVideoRef = useRef<File | null>(null);
  const historyRefsRef = useRef<File[]>([]);
  const historyAudiosRef = useRef<File[]>([]);

  const refCount = referenceFiles.length + referenceFrames.length;
  const durationChoices = wanVideoEditDurationChoices();

  useEffect(() => {
    void listWanVideoEditHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

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

  useEffect(() => {
    if (phase !== "submitting" && phase !== "polling") return;
    const tick = window.setInterval(() => setNowTick(Date.now()), 500);
    return () => window.clearInterval(tick);
  }, [phase]);

  async function refreshHistory() {
    try {
      setHistory(await listWanVideoEditHistory());
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
      await saveWanVideoEditHistoryEntry({
        id: historyIdRef.current,
        createdAt: new Date().toISOString(),
        prompt,
        duration:
          duration === "auto" ? null : clampWanVideoEditDuration(duration),
        resolution,
        seed,
        generateAudio,
        enablePromptExpansion,
        sourceVideoName: historyVideoRef.current?.name,
        sourceVideo: historyVideoRef.current
          ? await fileToWanVideoEditStoredBlob(historyVideoRef.current)
          : null,
        referenceImages: await Promise.all(
          historyRefsRef.current.map((file) =>
            fileToWanVideoEditStoredBlob(file),
          ),
        ),
        referenceAudios: await Promise.all(
          historyAudiosRef.current.map((file) =>
            fileToWanVideoEditStoredBlob(file),
          ),
        ),
        predictionId: predictionId ?? "",
        status: update.status,
        outputs: update.outputs,
        inferenceMs: update.inferenceMs,
        error: update.error,
        source: "standalone",
      });
      await refreshHistory();
    } catch {
      // History is best-effort.
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function setVideoFromCandidates(candidates: FileList | File[] | null) {
    setRefError(null);
    if (!candidates || candidates.length === 0) return;
    const file = Array.from(candidates)[0];
    if (!file) return;
    const validationError = validateVideoFile(file);
    if (validationError) {
      setRefError(validationError);
      return;
    }
    setVideoFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function addReferenceFiles(candidates: FileList | File[] | null) {
    setRefError(null);
    if (!candidates || candidates.length === 0) return;
    const next = [...referenceFiles];
    for (const candidate of Array.from(candidates)) {
      if (next.length + referenceFrames.length >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES) {
        setRefError(
          `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES} reference images.`,
        );
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

  function addAudioFiles(candidates: FileList | File[] | null) {
    setRefError(null);
    if (!candidates || candidates.length === 0) return;
    const next = [...referenceAudios];
    for (const candidate of Array.from(candidates)) {
      if (next.length >= MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS) {
        setRefError(
          `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS} reference audio clips.`,
        );
        break;
      }
      const validationError = validateAudioFile(candidate);
      if (validationError) {
        setRefError(validationError);
        continue;
      }
      next.push(candidate);
    }
    setReferenceAudios(next);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  async function pollOnce(id: string) {
    const result = await pollWanVideoEditAction(id);
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
    if (!videoFile) {
      setError("Upload a source video to edit.");
      return;
    }

    setError(null);
    setOutputs([]);
    setPredictionId(null);
    setStatus(null);
    setApiProgress(null);
    setActiveHistoryId(null);
    historyIdRef.current = createWanVideoEditHistoryId();
    historyVideoRef.current = videoFile;
    historyRefsRef.current = [...referenceFiles];
    historyAudiosRef.current = [...referenceAudios];
    stopPolling();
    setPhase("submitting");
    setStartedAt(Date.now());

    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set(
      "duration",
      duration === "auto" ? "auto" : String(clampWanVideoEditDuration(duration)),
    );
    formData.set("resolution", resolution);
    if (seed.trim()) formData.set("seed", seed.trim());
    if (enablePromptExpansion) formData.set("enablePromptExpansion", "1");
    formData.set("generateAudio", generateAudio ? "1" : "0");
    formData.set("video", videoFile);

    for (const file of referenceFiles) {
      formData.append("referenceImages", file);
    }
    for (const frame of referenceFrames) {
      formData.append("referenceFrameAssetIds", frame.assetId);
    }
    for (const file of referenceAudios) {
      formData.append("referenceAudios", file);
    }

    const result = await submitWanVideoEditAction(formData);
    if (result.error || !result.predictionId) {
      setPhase("failed");
      setError(result.error ?? "Submit failed.");
      return;
    }

    setPredictionId(result.predictionId);
    setStatus(result.status ?? "created");
    startPolling(result.predictionId);
  }

  function restoreHistoryEntry(entry: WanVideoEditHistoryEntry) {
    if (phase === "submitting" || phase === "polling") return;
    stopPolling();
    setPrompt(entry.prompt);
    setDuration(entry.duration == null ? "auto" : entry.duration);
    setResolution(
      (entry.resolution as WanVideoEditResolution) ||
        DEFAULT_WAN_VIDEO_EDIT_RESOLUTION,
    );
    setSeed(entry.seed);
    setGenerateAudio(entry.generateAudio);
    setEnablePromptExpansion(entry.enablePromptExpansion);
    setReferenceFrames([]);
    setReferenceFiles(entry.referenceImages.map(wanVideoEditStoredBlobToFile));
    setReferenceAudios(entry.referenceAudios.map(wanVideoEditStoredBlobToFile));
    setVideoFile(
      entry.sourceVideo ? wanVideoEditStoredBlobToFile(entry.sourceVideo) : null,
    );
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
      await deleteWanVideoEditHistoryEntry(id);
      if (activeHistoryId === id) setActiveHistoryId(null);
      await refreshHistory();
    } catch {
      setError("Could not delete history item.");
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = event.dataTransfer.files;
    if (!files?.length) return;
    const first = files[0]!;
    if (first.type.startsWith("video/")) {
      setVideoFromCandidates(files);
      return;
    }
    if (first.type.startsWith("audio/")) {
      addAudioFiles(files);
      return;
    }
    addReferenceFiles(files);
  }

  const busy = phase === "submitting" || phase === "polling";
  const progress = estimateWanVideoEditProgressPercent({
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
            <code className="text-xs">.env</code>, then restart the app. Create a key at{" "}
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
        className="grid gap-6"
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Card className={cn(dragging && "ring-2 ring-foreground/30")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" />
              Wan 3.0 video edit
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="wan-video-edit-prompt">Prompt</Label>
              <Textarea
                id="wan-video-edit-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={busy || !configured}
                required
                rows={5}
                placeholder="Edit video 1: … Refer to Image 1 / Audio 1 when needed."
              />
              <p className="text-xs text-muted-foreground">
                Refer to assets as Video 1, Image 1, Audio 1 in upload order.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>
                Source video{" "}
                <span className="font-normal text-muted-foreground">(required)</span>
              </Label>
              <input
                ref={videoInputRef}
                id={videoInputId}
                type="file"
                accept={VIDEO_ACCEPT}
                className="sr-only"
                disabled={busy || !configured}
                onChange={(event) => setVideoFromCandidates(event.target.files)}
              />
              {videoFile && videoPreviewUrl ? (
                <div className="grid gap-2 rounded-xl border bg-muted/20 p-3">
                  <video
                    src={videoPreviewUrl}
                    controls
                    playsInline
                    className="max-h-56 w-full rounded-lg bg-black object-contain"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm">{videoFile.name}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setVideoFile(null)}
                    >
                      <X className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-2 py-6"
                  disabled={busy || !configured}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Upload video to edit (≤{" "}
                  {Math.round(MAX_WAN_VIDEO_EDIT_VIDEO_BYTES / (1024 * 1024))}MB)
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>
                Reference images{" "}
                <span className="font-normal text-muted-foreground">
                  (optional · up to {MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES})
                </span>
              </Label>
              <input
                ref={refInputRef}
                id={refInputId}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="sr-only"
                disabled={busy || !configured}
                onChange={(event) => addReferenceFiles(event.target.files)}
              />

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
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {referenceFiles.map((file, index) => (
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
                          setReferenceFiles((prev) =>
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

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    busy ||
                    !configured ||
                    refCount >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES
                  }
                  onClick={() => refInputRef.current?.click()}
                >
                  <Plus className="size-3.5" />
                  Upload images
                </Button>
                <KreaVideoFramePicker
                  label="Add from Video creator"
                  value={null}
                  onChange={() => undefined}
                  multi
                  onAdd={(frame) => {
                    if (refCount >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES) {
                      setRefError(
                        `At most ${MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES} reference images.`,
                      );
                      return;
                    }
                    if (referenceFrames.some((f) => f.assetId === frame.assetId)) {
                      return;
                    }
                    setReferenceFrames((prev) => [...prev, frame]);
                  }}
                  excludeIds={referenceFrames.map((f) => f.assetId)}
                  disabled={
                    busy ||
                    !configured ||
                    refCount >= MAX_WAN_VIDEO_EDIT_REFERENCE_IMAGES
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>
                Reference audio{" "}
                <span className="font-normal text-muted-foreground">
                  (optional · up to {MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS})
                </span>
              </Label>
              <input
                ref={audioInputRef}
                id={audioInputId}
                type="file"
                accept={AUDIO_ACCEPT}
                multiple
                className="sr-only"
                disabled={busy || !configured}
                onChange={(event) => addAudioFiles(event.target.files)}
              />
              {referenceAudios.length > 0 ? (
                <ul className="grid gap-2">
                  {referenceAudios.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="truncate">
                        Audio {index + 1} · {file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() =>
                          setReferenceAudios((prev) =>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={
                  busy ||
                  !configured ||
                  referenceAudios.length >= MAX_WAN_VIDEO_EDIT_REFERENCE_AUDIOS
                }
                onClick={() => audioInputRef.current?.click()}
              >
                <Plus className="size-3.5" />
                Add audio
              </Button>
            </div>

            {refError ? (
              <Alert variant="destructive">
                <AlertDescription>{refError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="wan-video-edit-duration">Duration</Label>
                <select
                  id="wan-video-edit-duration"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={duration === "auto" ? "auto" : String(duration)}
                  disabled={busy || !configured}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDuration(value === "auto" ? "auto" : Number(value));
                  }}
                >
                  <option value="auto">Auto (match input)</option>
                  {durationChoices.map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="wan-video-edit-resolution">Resolution</Label>
                <select
                  id="wan-video-edit-resolution"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={resolution}
                  disabled={busy || !configured}
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
                <Label htmlFor="wan-video-edit-seed">Seed (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="wan-video-edit-seed"
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
                <Label htmlFor="wan-video-edit-audio">Generate audio</Label>
                <Switch
                  id="wan-video-edit-audio"
                  checked={generateAudio}
                  disabled={busy || !configured}
                  onCheckedChange={setGenerateAudio}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Off preserves the source audio track when available.
              </p>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="wan-video-edit-expand">
                  Enable prompt expansion
                </Label>
                <Switch
                  id="wan-video-edit-expand"
                  checked={enablePromptExpansion}
                  disabled={busy || !configured}
                  onCheckedChange={setEnablePromptExpansion}
                />
              </div>
            </div>

            {busy || phase === "completed" || phase === "failed" ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {phase === "submitting"
                      ? "Uploading…"
                      : phase === "completed"
                        ? "Done"
                        : phase === "failed"
                          ? "Failed"
                          : (status ?? "Processing")}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {progress}%
                  </span>
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

            {outputs[0] ? (
              <div className="grid gap-3">
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
                  Download
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                disabled={busy || !configured || !prompt.trim() || !videoFile}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "submitting" ? "Uploading…" : "Editing…"}
                  </>
                ) : (
                  <>
                    <Clapperboard className="size-4" />
                    Run Wan video edit
                  </>
                )}
              </Button>
              {status ? <Badge variant="outline">{status}</Badge> : null}
              {predictionId ? (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {predictionId.slice(0, 12)}…
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Completed and failed runs are stored in this browser.
              </p>
            ) : (
              <ul className="grid gap-2">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => restoreHistoryEntry(entry)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-2 text-left transition hover:bg-muted/40",
                        activeHistoryId === entry.id && "ring-1 ring-foreground",
                      )}
                    >
                      <WanVideoEditHistoryThumb entry={entry} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {truncateWanVideoEditPrompt(entry.prompt)}
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                          <span>{formatWanVideoEditHistoryTime(entry.createdAt)}</span>
                          <span>{entry.resolution}</span>
                          <span>
                            {entry.duration == null
                              ? "auto"
                              : `${entry.duration}s`}
                          </span>
                          <span>{entry.status}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label="Delete history item"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeHistoryEntry(entry.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
