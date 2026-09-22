"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { GripVertical, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGE_FILES,
} from "@/lib/product-image-variants";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ROW_DRAG_TYPE = "application/x-product-image-row";

export interface ProductImageFieldValue {
  url: string;
  altText: string;
  isPrimary: boolean;
}

interface ProductImagesFieldProps {
  defaultImages: ProductImageFieldValue[];
}

interface ImageRow extends ProductImageFieldValue {
  id: string;
}

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toRows(images: ProductImageFieldValue[]): ImageRow[] {
  if (images.length === 0) {
    return [{ id: newId(), url: "", altText: "", isPrimary: true }];
  }
  return images.map((image) => ({ ...image, id: newId() }));
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

export function ProductImagesField({ defaultImages }: ProductImagesFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImageRow[]>(() => toRows(defaultImages));
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const pendingFilesRef = useRef(pendingFiles);
  const [error, setError] = useState<string | null>(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [overRowId, setOverRowId] = useState<string | null>(null);
  const [dragPendingId, setDragPendingId] = useState<string | null>(null);
  const [overPendingId, setOverPendingId] = useState<string | null>(null);

  pendingFilesRef.current = pendingFiles;

  useEffect(() => {
    return () => {
      for (const pending of pendingFilesRef.current) {
        URL.revokeObjectURL(pending.previewUrl);
      }
    };
  }, []);

  function syncInputFiles(files: File[]) {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const transfer = new DataTransfer();
    for (const file of files) {
      transfer.items.add(file);
    }
    input.files = transfer.files;
  }

  function setPending(next: PendingFile[]) {
    setPendingFiles(next);
    // Reset first so the same path can be re-selected later, then restore
    // the FileList via DataTransfer so the form still submits all files.
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    syncInputFiles(next.map((item) => item.file));
  }

  function addFiles(candidates: FileList | File[] | null) {
    if (!candidates || candidates.length === 0) {
      return;
    }

    setError(null);
    const next = [...pendingFiles];
    const rejected: string[] = [];

    for (const candidate of Array.from(candidates)) {
      if (next.length >= MAX_PRODUCT_IMAGE_FILES) {
        rejected.push(`Only ${MAX_PRODUCT_IMAGE_FILES} uploads are allowed at once.`);
        break;
      }
      if (!ACCEPT_SET.has(candidate.type)) {
        rejected.push(`"${candidate.name}" must be a JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (candidate.size <= 0) {
        rejected.push(`"${candidate.name}" is empty.`);
        continue;
      }
      if (candidate.size > MAX_PRODUCT_IMAGE_BYTES) {
        rejected.push(`"${candidate.name}" is larger than 5MB.`);
        continue;
      }
      const alreadyAdded = next.some(
        (item) =>
          item.file.name === candidate.name &&
          item.file.size === candidate.size &&
          item.file.lastModified === candidate.lastModified,
      );
      if (alreadyAdded) {
        continue;
      }
      next.push({
        id: newId(),
        file: candidate,
        previewUrl: URL.createObjectURL(candidate),
      });
    }

    setPending(next);
    if (rejected.length > 0) {
      setError(rejected[0] ?? null);
    }
  }

  function removePending(id: string) {
    setError(null);
    const target = pendingFiles.find((item) => item.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    setPending(pendingFiles.filter((item) => item.id !== id));
  }

  function setPrimary(id: string) {
    setRows((current) => current.map((row) => ({ ...row, isPrimary: row.id === id })));
  }

  function removeRow(id: string) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      if (next.length === 0) {
        return [{ id: newId(), url: "", altText: "", isPrimary: true }];
      }
      if (!next.some((row) => row.isPrimary)) {
        next[0] = { ...next[0]!, isPrimary: true };
      }
      return next;
    });
  }

  function onRowDragStart(event: DragEvent<HTMLButtonElement>, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ROW_DRAG_TYPE, id);
    event.dataTransfer.setData("text/plain", id);
    setDragRowId(id);
    setOverRowId(id);
  }

  function onRowDragOver(event: DragEvent<HTMLDivElement>, id: string) {
    if (!dragRowId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overRowId !== id) {
      setOverRowId(id);
    }
  }

  function onRowDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const sourceId = dragRowId ?? event.dataTransfer.getData(ROW_DRAG_TYPE);
    setDragRowId(null);
    setOverRowId(null);
    if (!sourceId || sourceId === targetId) {
      return;
    }
    setRows((current) => {
      const fromIndex = current.findIndex((row) => row.id === sourceId);
      const toIndex = current.findIndex((row) => row.id === targetId);
      return reorderList(current, fromIndex, toIndex);
    });
  }

  function onRowDragEnd() {
    setDragRowId(null);
    setOverRowId(null);
  }

  function onPendingDragStart(event: DragEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ROW_DRAG_TYPE, id);
    event.dataTransfer.setData("text/plain", id);
    setDragPendingId(id);
    setOverPendingId(id);
  }

  function onPendingDragOver(event: DragEvent<HTMLLIElement>, id: string) {
    if (!dragPendingId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (overPendingId !== id) {
      setOverPendingId(id);
    }
  }

  function onPendingDrop(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = dragPendingId ?? event.dataTransfer.getData(ROW_DRAG_TYPE);
    setDragPendingId(null);
    setOverPendingId(null);
    if (!sourceId || sourceId === targetId) {
      return;
    }
    const fromIndex = pendingFiles.findIndex((item) => item.id === sourceId);
    const toIndex = pendingFiles.findIndex((item) => item.id === targetId);
    setPending(reorderList(pendingFiles, fromIndex, toIndex));
  }

  function onPendingDragEnd() {
    setDragPendingId(null);
    setOverPendingId(null);
  }

  function onFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setFileDragging(false);
    if (dragPendingId || dragRowId) {
      return;
    }
    addFiles(event.dataTransfer.files);
  }

  const maxMb = Math.round(MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024));

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <div
          key={row.id}
          onDragOver={(event) => onRowDragOver(event, row.id)}
          onDrop={(event) => onRowDrop(event, row.id)}
          className={cn(
            "grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_96px_1fr_auto]",
            dragRowId === row.id && "opacity-60",
            overRowId === row.id && dragRowId && dragRowId !== row.id && "border-primary bg-primary/5",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            draggable
            aria-label={`Drag to reorder image ${index + 1}`}
            className="cursor-grab touch-none active:cursor-grabbing"
            onDragStart={(event) => onRowDragStart(event, row.id)}
            onDragEnd={onRowDragEnd}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </Button>

          <div className="overflow-hidden rounded-md bg-muted">
            {row.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.url} alt="" className="aspect-square h-24 w-full object-cover" />
            ) : (
              <div className="flex aspect-square h-24 items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`imageUrl-${row.id}`} className="text-xs">
                Image URL
              </Label>
              <Input
                id={`imageUrl-${row.id}`}
                name="imageUrl"
                value={row.url}
                placeholder="https://…"
                onChange={(event) => {
                  const url = event.target.value;
                  setRows((current) =>
                    current.map((item) => (item.id === row.id ? { ...item, url } : item)),
                  );
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`imageAlt-${row.id}`} className="text-xs">
                Alt text
              </Label>
              <Input
                id={`imageAlt-${row.id}`}
                name="imageAlt"
                value={row.altText}
                onChange={(event) => {
                  const altText = event.target.value;
                  setRows((current) =>
                    current.map((item) => (item.id === row.id ? { ...item, altText } : item)),
                  );
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="imagePrimary"
                value={index}
                checked={row.isPrimary}
                onChange={() => setPrimary(row.id)}
              />
              Primary image
            </label>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove image"
            onClick={() => removeRow(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() =>
          setRows((current) => [
            ...current,
            { id: newId(), url: "", altText: "", isPrimary: current.length === 0 },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Add image URL
      </Button>

      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId} className="text-xs">
          Or upload images from this device
        </Label>

        <input
          ref={inputRef}
          id={inputId}
          name="imageFiles"
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
          }}
        />

        <label
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!dragPendingId && !dragRowId) setFileDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!dragPendingId && !dragRowId) setFileDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setFileDragging(false);
          }}
          onDrop={onFileDrop}
          className={cn(
            "flex cursor-pointer flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors",
            fileDragging && "border-primary bg-primary/5",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
              <ImagePlus className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Upload className="size-3.5 shrink-0" />
                {pendingFiles.length > 0
                  ? `${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"} ready to upload`
                  : "Drag & drop images, or click to browse"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                JPEG, PNG, WebP, GIF · up to {MAX_PRODUCT_IMAGE_FILES} files · {maxMb}MB each · browse again to add
                more
              </p>
            </div>
          </div>

          {pendingFiles.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pendingFiles.map((pending) => (
                <li
                  key={pending.id}
                  onDragOver={(event) => onPendingDragOver(event, pending.id)}
                  onDrop={(event) => onPendingDrop(event, pending.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg bg-background p-2 ring-1 ring-border",
                    dragPendingId === pending.id && "opacity-60",
                    overPendingId === pending.id &&
                      dragPendingId &&
                      dragPendingId !== pending.id &&
                      "ring-primary bg-primary/5",
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    draggable
                    aria-label={`Drag to reorder ${pending.file.name}`}
                    className="cursor-grab touch-none active:cursor-grabbing"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDragStart={(event) => onPendingDragStart(event, pending.id)}
                    onDragEnd={onPendingDragEnd}
                  >
                    <GripVertical className="size-4 text-muted-foreground" />
                  </Button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pending.previewUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{pending.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(pending.file.size / (1024 * 1024)).toFixed(2)}MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${pending.file.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removePending(pending.id);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Drag the grip handle to reorder images. Remote images must be https URLs. Local uploads are stored on this
        server with thumbnail variants for faster product lists. Save the product to apply order and uploads.
      </p>
    </div>
  );
}
