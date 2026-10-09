"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Plus, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MAX_WAN_IMAGE_BYTES,
  MAX_WAN_REFERENCE_IMAGES,
} from "@/lib/wan-image-edit";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateWanImageFile(candidate: File): string | null {
  if (!ACCEPT_SET.has(candidate.type)) {
    return "Use a JPEG, PNG, WebP, or GIF.";
  }
  if (candidate.size > MAX_WAN_IMAGE_BYTES) {
    return `Image must be ${Math.round(MAX_WAN_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}

interface WanReferenceImagesPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Compact layout for dialogs. */
  compact?: boolean;
}

export function WanReferenceImagesPicker({
  files,
  onChange,
  disabled = false,
  compact = false,
}: WanReferenceImagesPickerProps) {
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
      const validationError = validateWanImageFile(candidate);
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
        <ul className={cn("grid gap-2", compact && "gap-1.5")}>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-muted/20",
                compact ? "p-2" : "p-3",
              )}
            >
              {previewUrls[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[index]}
                  alt=""
                  className={cn(
                    "rounded-lg object-cover ring-1 ring-border",
                    compact ? "size-12" : "size-16",
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "rounded-lg bg-background ring-1 ring-border",
                    compact ? "size-12" : "size-16",
                  )}
                />
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
              "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 transition-colors",
              compact ? "p-3" : "p-4",
              dragging && "border-primary bg-primary/5",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border",
                compact ? "size-8" : "size-10",
              )}
            >
              <Plus className={compact ? "size-4" : "size-5"} />
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
