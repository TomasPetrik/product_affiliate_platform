"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface ImageDropzoneProps {
  name?: string;
  maxBytes: number;
  className?: string;
  disabled?: boolean;
}

export function ImageDropzone({
  name = "imageFiles",
  maxBytes,
  className,
  disabled = false,
}: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function syncInputFiles(next: File | null) {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (!next) {
      input.value = "";
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(next);
    input.files = transfer.files;
  }

  function selectFile(candidate: File | null) {
    setError(null);
    if (!candidate) {
      setFile(null);
      syncInputFiles(null);
      return;
    }
    if (!ACCEPT_SET.has(candidate.type)) {
      setError("Use a JPEG, PNG, WebP, or GIF.");
      setFile(null);
      syncInputFiles(null);
      return;
    }
    if (candidate.size > maxBytes) {
      setError(`Image must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`);
      setFile(null);
      syncInputFiles(null);
      return;
    }
    setFile(candidate);
    syncInputFiles(candidate);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (disabled) {
      return;
    }
    const dropped = event.dataTransfer.files?.[0] ?? null;
    selectFile(dropped);
  }

  const maxMb = Math.round(maxBytes / (1024 * 1024));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
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
          <div className="overflow-hidden rounded-lg bg-background ring-1 ring-border">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="size-16 object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center text-muted-foreground">
                <ImagePlus className="size-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Upload className="size-3.5 shrink-0" />
              {file ? "Ready to upload" : "Drag & drop a hero image"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {file
                ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)}MB`
                : `or click to browse · JPEG, PNG, WebP, GIF · ${maxMb}MB max`}
            </p>
          </div>

          {file ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selected image"
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
