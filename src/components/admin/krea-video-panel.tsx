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
  ImagePlus,
  Loader2,
  RefreshCw,
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
import {
  DEFAULT_KREA_VIDEO_MODEL_ID,
  durationChoicesForModel,
  estimateKreaVideoProgressPercent,
  getKreaVideoModel,
  isKreaCompleted,
  isKreaTerminalFailure,
  KREA_VIDEO_MODELS,
  MAX_KREA_IMAGE_BYTES,
  MAX_KREA_REFERENCE_IMAGES,
  randomKreaSeed,
  type KreaVideoModelDef,
} from "@/lib/krea-video";
import { cn } from "@/lib/utils";
import {
  pollKreaVideoAction,
  submitKreaVideoAction,
} from "@/server/actions/krea-video.actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const POLL_INTERVAL_MS = 5000;

type JobPhase = "idle" | "submitting" | "polling" | "completed" | "failed";

function validateImageFile(candidate: File): string | null {
  if (!ACCEPT_SET.has(candidate.type)) {
    return "Use a JPEG, PNG, WebP, or GIF.";
  }
  if (candidate.size > MAX_KREA_IMAGE_BYTES) {
    return `Image must be ${Math.round(MAX_KREA_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function ImageSlot({
  label,
  hint,
  file,
  onFileChange,
  frame,
  onFrameChange,
  disabled,
  required,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  frame: PickedKreaFrame | null;
  onFrameChange: (frame: PickedKreaFrame | null) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(file);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function selectFile(candidate: File | null) {
    setError(null);
    if (!candidate) {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const validationError = validateImageFile(candidate);
    if (validationError) {
      setError(validationError);
      return;
    }
    onFrameChange(null);
    onFileChange(candidate);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (disabled) return;
    const candidate = event.dataTransfer.files?.[0] ?? null;
    selectFile(candidate);
  }

  const displayUrl = previewUrl ?? frame?.previewPath ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={inputId}>
          {label}
          {required ? "" : " "}
          {!required ? (
            <span className="font-normal text-muted-foreground">(optional)</span>
          ) : null}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {displayUrl ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt=""
            className="size-16 rounded-lg object-cover ring-1 ring-border"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {file?.name ?? frame?.fileName ?? "Selected frame"}
            </p>
            <p className="text-xs text-muted-foreground">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)}MB upload`
                : frame
                  ? "From Video creator"
                  : null}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Clear ${label}`}
            disabled={disabled}
            onClick={() => {
              onFileChange(null);
              onFrameChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
          <label
            htmlFor={inputId}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors",
              dragging && "border-primary bg-primary/5",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
              <ImagePlus className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Upload className="size-3.5 shrink-0" />
                Upload image
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Drag & drop or click · JPEG / PNG / WebP / GIF
              </p>
            </div>
          </label>
        </>
      )}

      <KreaVideoFramePicker
        label={`Or pick ${label.toLowerCase()} from Video creator`}
        value={frame}
        onChange={(next) => {
          if (next) onFileChange(null);
          onFrameChange(next);
        }}
        disabled={disabled}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

interface KreaVideoPanelProps {
  configured: boolean;
}

export function KreaVideoPanel({ configured }: KreaVideoPanelProps) {
  const [modelId, setModelId] = useState(DEFAULT_KREA_VIDEO_MODEL_ID);
  const model = getKreaVideoModel(modelId) ?? KREA_VIDEO_MODELS[0];

  const [prompt, setPrompt] = useState("");
  const [startFile, setStartFile] = useState<File | null>(null);
  const [startFrame, setStartFrame] = useState<PickedKreaFrame | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const [endFrame, setEndFrame] = useState<PickedKreaFrame | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referenceFrames, setReferenceFrames] = useState<PickedKreaFrame[]>([]);
  const [duration, setDuration] = useState(model.defaultDuration);
  const [resolution, setResolution] = useState(model.defaultResolution);
  const [aspectRatio, setAspectRatio] = useState(model.defaultAspectRatio);
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<"std" | "pro" | "4k">("std");
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [draft, setDraft] = useState(false);
  const [upscale, setUpscale] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);

  const [phase, setPhase] = useState<JobPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [apiProgress, setApiProgress] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [refPreviewUrls, setRefPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    applyModelDefaults(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset settings when model changes
  }, [modelId]);

  useEffect(() => {
    const urlsNext = referenceFiles.map((file) => URL.createObjectURL(file));
    setRefPreviewUrls(urlsNext);
    return () => {
      for (const url of urlsNext) URL.revokeObjectURL(url);
    };
  }, [referenceFiles]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "polling" && phase !== "submitting") return;
    const timer = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, [phase]);

  function applyModelDefaults(next: KreaVideoModelDef) {
    setDuration(next.defaultDuration);
    setResolution(next.defaultResolution);
    setAspectRatio(next.defaultAspectRatio);
    setMode("std");
    setEnhancePrompt(false);
    setDraft(false);
    setUpscale(false);
    setGenerateAudio(false);
    if (next.maxReferenceImages === 0) {
      setReferenceFiles([]);
      setReferenceFrames([]);
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
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
    setApiProgress(
      typeof result.progress === "number" ? result.progress : null,
    );

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

  function addReferenceFiles(candidates: FileList | File[] | null) {
    setRefError(null);
    if (!candidates || candidates.length === 0) return;
    const maxRefs = Math.min(model.maxReferenceImages, MAX_KREA_REFERENCE_IMAGES);
    const next = [...referenceFiles];
    for (const candidate of Array.from(candidates)) {
      if (next.length + referenceFrames.length >= maxRefs) {
        setRefError(`At most ${maxRefs} reference images for ${model.label}.`);
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!configured || phase === "submitting" || phase === "polling") return;

    setError(null);
    setUrls([]);
    setJobId(null);
    setStatus(null);
    setApiProgress(null);
    stopPolling();
    setPhase("submitting");
    setStartedAt(Date.now());

    const formData = new FormData();
    formData.set("modelId", model.id);
    formData.set("prompt", prompt);
    formData.set("duration", String(duration));
    formData.set("aspectRatio", aspectRatio);
    if (model.resolutions.length > 0) {
      formData.set("resolution", resolution);
    }
    if (seed.trim()) formData.set("seed", seed.trim());
    if (model.modes?.length) formData.set("mode", mode);
    if (enhancePrompt) formData.set("enhancePrompt", "1");
    if (draft) formData.set("draft", "1");
    if (upscale) formData.set("upscale", "1");
    if (generateAudio) formData.set("generateAudio", "1");

    if (startFile) formData.set("startImage", startFile);
    if (startFrame) formData.set("startFrameAssetId", startFrame.assetId);
    if (endFile) formData.set("endImage", endFile);
    if (endFrame) formData.set("endFrameAssetId", endFrame.assetId);
    for (const file of referenceFiles) {
      formData.append("referenceImages", file);
    }
    for (const frame of referenceFrames) {
      formData.append("referenceFrameAssetIds", frame.assetId);
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
  const maxRefs = Math.min(model.maxReferenceImages, MAX_KREA_REFERENCE_IMAGES);
  const refCount = referenceFiles.length + referenceFrames.length;

  const modelsByGroup = KREA_VIDEO_MODELS.reduce(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {} as Record<string, KreaVideoModelDef[]>,
  );

  return (
    <div className="grid gap-6">
      {!configured ? (
        <Alert>
          <AlertDescription>
            Set <code className="text-xs">KREA_API_KEY</code> in{" "}
            <code className="text-xs">.env</code>, then restart the app. Create a
            token at{" "}
            <a
              href="https://www.krea.ai/settings/api-tokens"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              krea.ai/settings/api-tokens
            </a>{" "}
            and top up API balance at{" "}
            <a
              href="https://www.krea.ai/app/api/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              krea.ai/app/api
            </a>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,380px)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" />
              Generate video
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="krea-model">Model</Label>
              <select
                id="krea-model"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={modelId}
                disabled={busy || !configured}
                onChange={(event) => setModelId(event.target.value)}
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
              <p className="text-xs text-muted-foreground">{model.description}</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="krea-prompt">Prompt</Label>
              <Textarea
                id="krea-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={busy || !configured}
                required
                rows={5}
                placeholder="Slow push-in on the product on a clean desk, soft daylight, subtle camera drift, cinematic product ad."
              />
            </div>

            <ImageSlot
              label="Start frame"
              hint="Image-to-video start still — upload or pick from Video creator."
              file={startFile}
              onFileChange={setStartFile}
              frame={startFrame}
              onFrameChange={setStartFrame}
              disabled={busy || !configured}
            />

            {model.supportsEndImage ? (
              <ImageSlot
                label="End frame"
                hint="Optional last frame for models that support start→end animation."
                file={endFile}
                onFileChange={setEndFile}
                frame={endFrame}
                onFrameChange={setEndFrame}
                disabled={busy || !configured}
              />
            ) : null}

            {maxRefs > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>
                  Reference images{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional · up to {maxRefs})
                  </span>
                </Label>

                {referenceFrames.length > 0 ? (
                  <ul className="grid gap-2">
                    {referenceFrames.map((frame) => (
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
                          <p className="truncate text-sm font-medium">{frame.fileName}</p>
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
                          <p className="truncate text-sm font-medium">{file.name}</p>
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

                {refCount < maxRefs ? (
                  <>
                    <input
                      ref={refInputRef}
                      type="file"
                      accept={ACCEPT}
                      multiple
                      className="sr-only"
                      id="krea-refs"
                      disabled={busy || !configured}
                      onChange={(event) => addReferenceFiles(event.target.files)}
                    />
                    <label
                      htmlFor="krea-refs"
                      className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      <Upload className="size-3.5" />
                      Upload references ({refCount}/{maxRefs})
                    </label>
                    <KreaVideoFramePicker
                      label="Add reference from Video creator"
                      value={null}
                      onChange={() => undefined}
                      multi
                      onAdd={(frame) => {
                        if (refCount >= maxRefs) {
                          setRefError(`At most ${maxRefs} reference images.`);
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
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="krea-duration">Duration (seconds)</Label>
                <select
                  id="krea-duration"
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
                <p className="text-xs text-muted-foreground">
                  {model.label} allows {model.durationMin}–{model.durationMax}s
                  {model.durationMin > 2
                    ? " · for 2s clips use Seedance 1.0 Pro Fast or Wan 3.0"
                    : ""}
                  .
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="krea-aspect">Aspect ratio</Label>
                <select
                  id="krea-aspect"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={aspectRatio}
                  disabled={busy || !configured}
                  onChange={(event) =>
                    setAspectRatio(
                      event.target.value as typeof aspectRatio,
                    )
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
                  <Label htmlFor="krea-resolution">Resolution</Label>
                  <select
                    id="krea-resolution"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={resolution}
                    disabled={busy || !configured || draft}
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

              {model.modes?.length ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="krea-mode">Mode</Label>
                  <select
                    id="krea-mode"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={mode}
                    disabled={busy || !configured}
                    onChange={(event) =>
                      setMode(event.target.value as typeof mode)
                    }
                  >
                    {model.modes.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="krea-seed">Seed (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="krea-seed"
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
                    onClick={() => setSeed(String(randomKreaSeed()))}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {model.supportsEnhancePrompt ? (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="krea-enhance">Enhance prompt (Krea rewrite)</Label>
                  <Switch
                    id="krea-enhance"
                    checked={enhancePrompt}
                    disabled={busy || !configured}
                    onCheckedChange={setEnhancePrompt}
                  />
                </div>
              ) : null}
              {model.supportsDraft ? (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="krea-draft">Draft (fast 480p preview, cheaper)</Label>
                  <Switch
                    id="krea-draft"
                    checked={draft}
                    disabled={busy || !configured}
                    onCheckedChange={setDraft}
                  />
                </div>
              ) : null}
              {model.supportsUpscale ? (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="krea-upscale">Upscale output (up to 8K)</Label>
                  <Switch
                    id="krea-upscale"
                    checked={upscale}
                    disabled={busy || !configured}
                    onCheckedChange={setUpscale}
                  />
                </div>
              ) : null}
              {model.supportsGenerateAudio ? (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="krea-audio">Generate audio</Label>
                  <Switch
                    id="krea-audio"
                    checked={generateAudio}
                    disabled={busy || !configured}
                    onCheckedChange={setGenerateAudio}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={busy || !configured || !prompt.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "submitting" ? "Uploading…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Clapperboard className="size-4" />
                    Generate with {model.label}
                  </>
                )}
              </Button>
              {jobId ? (
                <Badge variant="secondary" className="font-mono text-xs">
                  {jobId}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {urls[0] ? (
              <>
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
                    <a href={urls[0]} download target="_blank" rel="noreferrer" />
                  }
                >
                  <Download className="size-3.5" />
                  Download video
                </Button>
                {urls.length > 1 ? (
                  <ul className="grid gap-2">
                    {urls.slice(1).map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-xs text-muted-foreground underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generated video will appear here. Use a start frame from Video creator
                for image-to-video, or prompt-only for text-to-video.
              </p>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
