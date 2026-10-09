"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Download,
  History,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WAN_SIZE,
  isWanCompleted,
  isWanTerminalFailure,
  MAX_WAN_IMAGE_BYTES,
  MAX_WAN_REFERENCE_IMAGES,
  randomWanSeed,
  WAN_SIZE_PRESETS,
} from "@/lib/wan-image-edit";
import {
  createWanHistoryId,
  deleteWanHistoryEntry,
  fileToStoredImage,
  formatWanHistoryTime,
  listWanHistory,
  saveWanHistoryEntry,
  storedImageToFile,
  truncateWanPrompt,
  type WanHistoryEntry,
} from "@/lib/wan-image-edit-history";
import {
  pollWanImageEditAction,
  submitWanImageEditAction,
} from "@/server/actions/wan-image-edit.actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const POLL_INTERVAL_MS = 2000;

type JobPhase = "idle" | "submitting" | "polling" | "completed" | "failed";

interface LightboxState {
  url: string;
  label: string;
}

function validateImageFile(candidate: File): string | null {
  if (!ACCEPT_SET.has(candidate.type)) {
    return "Use a JPEG, PNG, WebP, or GIF.";
  }
  if (candidate.size > MAX_WAN_IMAGE_BYTES) {
    return `Image must be ${Math.round(MAX_WAN_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
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

function ThumbnailPreview({
  url,
  label,
  onOpen,
}: {
  url: string;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="overflow-hidden rounded-lg bg-background ring-1 ring-border transition hover:ring-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View ${label} full size`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-16 object-cover" />
    </button>
  );
}

interface FramePickerProps {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onPreview: (url: string, label: string) => void;
  disabled?: boolean;
  required?: boolean;
}

function FramePicker({
  label,
  hint,
  file,
  onChange,
  onPreview,
  disabled = false,
  required = false,
}: FramePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(file);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function selectFile(candidate: File | null) {
    setError(null);
    if (!candidate) {
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const validationError = validateImageFile(candidate);
    if (validationError) {
      setError(validationError);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onChange(candidate);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>
        {label}
        {required ? "" : " (optional)"}
      </Label>
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
          "flex cursor-pointer flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors",
          dragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <ThumbnailPreview
              url={previewUrl}
              label={label}
              onOpen={() => onPreview(previewUrl, file?.name || label)}
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
              <ImagePlus className="size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Upload className="size-3.5 shrink-0" />
              {file ? "Ready · click thumbnail to enlarge" : hint}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {file
                ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)}MB`
                : `JPEG, PNG, WebP, GIF · ${Math.round(MAX_WAN_IMAGE_BYTES / (1024 * 1024))}MB max`}
            </p>
          </div>
          {file ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Clear ${label}`}
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

interface ReferenceImagesPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  onPreview: (url: string, label: string) => void;
  disabled?: boolean;
}

function ReferenceImagesPicker({
  files,
  onChange,
  onPreview,
  disabled = false,
}: ReferenceImagesPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [files]);

  function addFiles(candidates: FileList | File[] | null) {
    setError(null);
    if (!candidates || candidates.length === 0) return;

    const next = [...files];
    for (const candidate of Array.from(candidates)) {
      if (next.length >= MAX_WAN_REFERENCE_IMAGES) {
        setError(`At most ${MAX_WAN_REFERENCE_IMAGES} reference images.`);
        break;
      }
      const validationError = validateImageFile(candidate);
      if (validationError) {
        setError(validationError);
        continue;
      }
      next.push(candidate);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (disabled) return;
    addFiles(event.dataTransfer.files);
  }

  const canAdd = files.length < MAX_WAN_REFERENCE_IMAGES;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        Reference images{" "}
        <span className="font-normal text-muted-foreground">
          (optional · up to {MAX_WAN_REFERENCE_IMAGES})
        </span>
      </Label>

      {files.length > 0 ? (
        <ul className="grid gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3"
            >
              {previewUrls[index] ? (
                <ThumbnailPreview
                  url={previewUrls[index]!}
                  label={`Figure ${index + 2}`}
                  onOpen={() =>
                    onPreview(previewUrls[index]!, file.name || `Figure ${index + 2}`)
                  }
                />
              ) : (
                <div className="size-16 rounded-lg bg-background ring-1 ring-border" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Figure {index + 2}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)}MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => removeAt(index)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {canAdd ? (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(event) => addFiles(event.target.files)}
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
              <Plus className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Upload className="size-3.5 shrink-0" />
                Add reference image
                {files.length > 0 ? ` (${files.length}/${MAX_WAN_REFERENCE_IMAGES})` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Drag & drop or click · multi-select supported
              </p>
            </div>
          </label>
        </>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

interface PendingHistoryDraft {
  id: string;
  prompt: string;
  size: string;
  seed: string;
  mainImage: File;
  referenceImages: File[];
  predictionId: string;
}

function HistoryThumb({
  entry,
}: {
  entry: WanHistoryEntry;
}) {
  const outputUrl = entry.outputs[0] ?? null;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (outputUrl) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(entry.mainImage.blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [entry.mainImage.blob, outputUrl]);

  const src = outputUrl ?? blobUrl;
  if (!src) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ImagePlus className="size-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-12 shrink-0 rounded-md object-cover ring-1 ring-border"
    />
  );
}

interface WanImageEditPanelProps {
  configured: boolean;
}

export function WanImageEditPanel({ configured }: WanImageEditPanelProps) {
  const [image, setImage] = useState<File | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<string>(DEFAULT_WAN_SIZE);
  const [seed, setSeed] = useState("");
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [inferenceMs, setInferenceMs] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [history, setHistory] = useState<WanHistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingHistoryRef = useRef<PendingHistoryDraft | null>(null);

  useEffect(() => {
    void listWanHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function openPreview(url: string, label: string) {
    setLightbox({ url, label });
  }

  async function refreshHistory() {
    try {
      setHistory(await listWanHistory());
    } catch {
      // Keep existing list if IndexedDB is unavailable.
    }
  }

  async function persistHistoryDraft(update: {
    status: string;
    outputs: string[];
    inferenceMs?: number;
    error?: string;
  }) {
    const draft = pendingHistoryRef.current;
    if (!draft) return;

    try {
      const entry: WanHistoryEntry = {
        id: draft.id,
        createdAt: new Date().toISOString(),
        prompt: draft.prompt,
        size: draft.size,
        seed: draft.seed,
        mainImage: await fileToStoredImage(draft.mainImage),
        referenceImages: await Promise.all(
          draft.referenceImages.map((file) => fileToStoredImage(file)),
        ),
        predictionId: draft.predictionId,
        status: update.status,
        outputs: update.outputs,
        inferenceMs: update.inferenceMs,
        error: update.error,
        source: "standalone",
      };
      await saveWanHistoryEntry(entry);
      pendingHistoryRef.current = null;
      setActiveHistoryId(entry.id);
      await refreshHistory();
    } catch {
      // History is best-effort; don't block the main flow.
    }
  }

  async function pollOnce(id: string) {
    const result = await pollWanImageEditAction(id);
    if (result.error && isWanTerminalFailure(result.status)) {
      stopPolling();
      setPhase("failed");
      setStatus(result.status);
      setError(result.error);
      await persistHistoryDraft({
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
      await persistHistoryDraft({
        status: "failed",
        outputs: [],
        error: result.error,
      });
      return;
    }

    setStatus(result.status);
    setOutputs(result.outputs);
    setInferenceMs(result.inferenceMs);

    if (isWanCompleted(result.status)) {
      stopPolling();
      setPhase("completed");
      setError(null);
      await persistHistoryDraft({
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
      await persistHistoryDraft({
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
    if (!image) return;

    setError(null);
    setOutputs([]);
    setInferenceMs(undefined);
    setPredictionId(null);
    setStatus(null);
    setActiveHistoryId(null);
    pendingHistoryRef.current = null;
    stopPolling();
    setPhase("submitting");

    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set("size", size);
    if (seed.trim()) formData.set("seed", seed.trim());
    formData.set("image", image);
    for (const reference of referenceImages) {
      formData.append("referenceImages", reference);
    }

    const result = await submitWanImageEditAction(formData);
    if (result.error || !result.predictionId) {
      setPhase("failed");
      setError(result.error ?? "Submit failed.");
      return;
    }

    pendingHistoryRef.current = {
      id: createWanHistoryId(),
      prompt: prompt.trim(),
      size,
      seed: seed.trim(),
      mainImage: image,
      referenceImages: [...referenceImages],
      predictionId: result.predictionId,
    };

    setPredictionId(result.predictionId);
    setStatus(result.status ?? "created");
    startPolling(result.predictionId);
  }

  function restoreHistoryEntry(entry: WanHistoryEntry) {
    if (phase === "submitting" || phase === "polling") return;
    stopPolling();
    pendingHistoryRef.current = null;
    setImage(storedImageToFile(entry.mainImage));
    setReferenceImages(entry.referenceImages.map(storedImageToFile));
    setPrompt(entry.prompt);
    setSize(entry.size || DEFAULT_WAN_SIZE);
    setSeed(entry.seed);
    setPredictionId(entry.predictionId);
    setStatus(entry.status);
    setOutputs(entry.outputs);
    setInferenceMs(entry.inferenceMs);
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
      await deleteWanHistoryEntry(id);
      if (activeHistoryId === id) setActiveHistoryId(null);
      await refreshHistory();
    } catch {
      setError("Could not delete history item.");
    }
  }

  const busy = phase === "submitting" || phase === "polling";

  return (
    <div className="grid gap-6">
      {!configured ? (
        <Alert>
          <AlertDescription>
            Set <code className="text-xs">WAVESPEED_API_KEY</code> in{" "}
            <code className="text-xs">.env</code>, then restart the app.
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_minmax(240px,360px)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Edit inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FramePicker
              label="Main image"
              hint="Drop a video frame or product still"
              file={image}
              onChange={setImage}
              onPreview={openPreview}
              disabled={busy || !configured}
              required
            />
            <ReferenceImagesPicker
              files={referenceImages}
              onChange={setReferenceImages}
              onPreview={openPreview}
              disabled={busy || !configured}
            />

            <div className="grid gap-1.5">
              <Label htmlFor="wan-prompt">Prompt</Label>
              <Textarea
                id="wan-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={busy || !configured}
                required
                rows={5}
                placeholder="Change the background to a clean white studio. Keep the product and lighting unchanged."
              />
              <p className="text-xs text-muted-foreground">
                Say what to change and what to keep. Refer to images as &quot;Figure 1&quot;
                (main), &quot;Figure 2&quot;, &quot;Figure 3&quot;, …
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="wan-size">Size</Label>
                <select
                  id="wan-size"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={size}
                  disabled={busy || !configured}
                  onChange={(event) => setSize(event.target.value)}
                >
                  {WAN_SIZE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Default is 9:16 (TikTok / Reels). Format: width*height.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wan-seed">Seed (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="wan-seed"
                    type="number"
                    inputMode="numeric"
                    placeholder="-1 for random"
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
                    title="Generate random seed"
                    disabled={busy || !configured}
                    onClick={() => setSeed(String(randomWanSeed()))}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy || !configured || !image || !prompt.trim()}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "submitting" ? "Uploading…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Run Wan 2.7 Edit Pro
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
                  This browser · includes video-frame edits · tap to prefill
                </span>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Completed runs from this tool and video-frame Wan edits appear here with
                  prompt, refs, and outputs.
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
                            <HistoryThumb entry={entry} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {truncateWanPrompt(entry.prompt)}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{formatWanHistoryTime(entry.createdAt)}</span>
                                <span>{entry.size}</span>
                                {entry.seed ? <span>seed {entry.seed}</span> : null}
                                {entry.referenceImages.length > 0 ? (
                                  <span>
                                    {entry.referenceImages.length} ref
                                    {entry.referenceImages.length === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                                {entry.source === "video-frame" ? (
                                  <span className="text-foreground/80">
                                    Video frame
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
            <CardTitle className="text-base">Output</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {phase === "idle" && outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Results appear here after the job completes (~20–30s typical).
              </p>
            ) : null}

            {busy ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {phase === "submitting"
                  ? "Uploading images and submitting…"
                  : "Polling WaveSpeed every 2s…"}
              </div>
            ) : null}

            {inferenceMs != null ? (
              <p className="text-xs text-muted-foreground">
                Inference: {(inferenceMs / 1000).toFixed(1)}s
              </p>
            ) : null}

            {outputs.length > 0 ? (
              <ul className="grid gap-4">
                {outputs.map((url, index) => (
                  <li key={url} className="grid gap-2">
                    <button
                      type="button"
                      className="overflow-hidden rounded-lg bg-muted ring-1 ring-border transition hover:ring-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openPreview(url, `Output ${index + 1}`)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Wan edit output ${index + 1}`}
                        className="mx-auto max-h-[480px] w-full object-contain"
                      />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      nativeButton={false}
                      render={
                        <a href={url} target="_blank" rel="noreferrer" download />
                      }
                    >
                      <Download className="size-3.5" />
                      Open / download
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </form>

      <Dialog.Root
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,52rem)] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-lg ring-1 ring-foreground/10 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-medium">
                  {lightbox?.label ?? "Image"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  Full size preview
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
              {lightbox ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightbox.url}
                  alt={lightbox.label}
                  className="max-h-[min(80vh,44rem)] w-auto max-w-full object-contain"
                />
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
