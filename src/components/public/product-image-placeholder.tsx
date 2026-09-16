"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ProductImagePlaceholderProps {
  seed: string;
  src?: string | null;
  /** Used when `src` fails to load (e.g. missing thumbnail sibling). */
  fallbackSrc?: string | null;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
}

/**
 * Product photo when a URL exists; otherwise a quiet placeholder until
 * uploads or marketplace import populate images.
 */
export function ProductImagePlaceholder({
  src,
  fallbackSrc,
  alt,
  className,
  fit = "cover",
}: ProductImagePlaceholderProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src ?? null);

  useEffect(() => {
    setCurrentSrc(src ?? null);
  }, [src]);

  if (currentSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt ?? ""}
        className={cn(
          "block max-w-full object-center",
          fit === "contain" ? "object-contain" : "object-cover",
          className,
        )}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
            return;
          }
          setCurrentSrc(null);
        }}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center bg-image-well", className)}
      role="img"
      aria-label="Product image placeholder"
    >
      <ImageIcon className="size-10 text-muted-foreground/40" strokeWidth={1.25} />
    </div>
  );
}
