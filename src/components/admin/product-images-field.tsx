"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProductImageFieldValue {
  url: string;
  altText: string;
  isPrimary: boolean;
}

interface ProductImagesFieldProps {
  defaultImages: ProductImageFieldValue[];
}

export function ProductImagesField({ defaultImages }: ProductImagesFieldProps) {
  const [rows, setRows] = useState<ProductImageFieldValue[]>(
    defaultImages.length > 0 ? defaultImages : [{ url: "", altText: "", isPrimary: true }],
  );

  function setPrimary(index: number) {
    setRows((current) => current.map((row, rowIndex) => ({ ...row, isPrimary: rowIndex === index })));
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      if (next.length === 0) {
        return [{ url: "", altText: "", isPrimary: true }];
      }
      if (!next.some((row) => row.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[96px_1fr_auto]">
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
              <Label htmlFor={`imageUrl-${index}`} className="text-xs">
                Image URL
              </Label>
              <Input
                id={`imageUrl-${index}`}
                name="imageUrl"
                value={row.url}
                placeholder="https://…"
                onChange={(event) => {
                  const url = event.target.value;
                  setRows((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, url } : item)));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`imageAlt-${index}`} className="text-xs">
                Alt text
              </Label>
              <Input
                id={`imageAlt-${index}`}
                name="imageAlt"
                value={row.altText}
                onChange={(event) => {
                  const altText = event.target.value;
                  setRows((current) =>
                    current.map((item, rowIndex) => (rowIndex === index ? { ...item, altText } : item)),
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
                onChange={() => setPrimary(index)}
              />
              Primary image
            </label>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove image"
            onClick={() => removeRow(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setRows((current) => [...current, { url: "", altText: "", isPrimary: current.length === 0 }])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add image URL
        </Button>

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="imageFiles" className="text-xs">
            Or upload images (JPEG, PNG, WebP, GIF · 2MB max)
          </Label>
          <Input id="imageFiles" name="imageFiles" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Remote images must be https URLs. Uploads are stored on this server and used as approved product images.
      </p>
    </div>
  );
}
