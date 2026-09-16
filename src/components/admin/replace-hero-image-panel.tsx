"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Copy, ImagePlus } from "lucide-react";

import { ImageDropzone } from "@/components/admin/image-dropzone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildProductHeroImagePrompt } from "@/lib/product-hero-image-prompt";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/lib/product-image-variants";
import {
  replaceHeroImageAction,
  type ProductActionState,
} from "@/server/actions/product.actions";

interface ReplaceHeroImagePanelProps {
  productId: string;
  title: string;
  brand: string | null;
  shortDescription: string | null;
  currentHeroUrl: string | null;
  highlight?: boolean;
}

export function ReplaceHeroImagePanel({
  productId,
  title,
  brand,
  shortDescription,
  currentHeroUrl,
  highlight = false,
}: ReplaceHeroImagePanelProps) {
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(
    replaceHeroImageAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(
    () => buildProductHeroImagePrompt({ title, brand, shortDescription }),
    [title, brand, shortDescription],
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card id="replace-hero" className={highlight ? "border-primary/40 ring-1 ring-primary/20" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImagePlus className="h-4 w-4" />
          Replace hero image
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          eBay seller photos often look unprofessional on RadarCut. Copy the prompt, paste it into ChatGPT with a
          product photo attached, generate a clean studio shot, then upload it here as the main card image. The old
          photo stays in the gallery.
        </p>

        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div className="overflow-hidden rounded-md bg-muted">
            {currentHeroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentHeroUrl} alt="" className="aspect-square h-28 w-full object-contain" />
            ) : (
              <div className="flex aspect-square h-28 items-center justify-center text-xs text-muted-foreground">
                No hero
              </div>
            )}
          </div>

          <details className="group flex flex-col gap-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>ChatGPT image prompt</span>
              <span className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(event) => {
                    event.preventDefault();
                    void copyPrompt();
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy prompt"}
                </Button>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </span>
            </summary>
            <div className="flex flex-col gap-2 pt-1">
              <Textarea id="hero-prompt" value={prompt} readOnly rows={10} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">
                In ChatGPT: paste this prompt and attach the current hero photo. Download the result, then upload
                below.
              </p>
            </div>
          </details>
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="productId" value={productId} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Upload new hero</Label>
              <ImageDropzone name="imageFiles" maxBytes={MAX_PRODUCT_IMAGE_BYTES} disabled={pending} />
              <p className="text-xs text-muted-foreground">
                Uploads are optimized into full + thumbnail variants for faster product lists.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="heroImageUrl">Or paste https image URL</Label>
              <Input id="heroImageUrl" name="heroImageUrl" placeholder="https://…" disabled={pending} />
              <p className="text-xs text-muted-foreground">
                Remote URLs are used as-is (no local thumbnails). Prefer uploading a file when you can.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="heroImageAlt">Alt text</Label>
            <Input id="heroImageAlt" name="heroImageAlt" defaultValue={title} maxLength={200} disabled={pending} />
          </div>

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Updating…" : "Set as main photo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
