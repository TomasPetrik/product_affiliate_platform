"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  title: string;
  images: Array<{ url: string; altText: string | null }>;
  fallbackUrl?: string | null;
  badge?: ReactNode;
}

export function ProductImageGallery({ title, images, fallbackUrl, badge }: ProductImageGalleryProps) {
  const fromProduct = images.map((image) => image.url).filter((url) => url.length > 0);
  const gallery = fromProduct.length > 0 ? fromProduct : fallbackUrl ? [fallbackUrl] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = gallery.length === 0 ? 0 : Math.min(activeIndex, gallery.length - 1);
  const activeUrl = gallery[safeIndex] ?? null;
  const activeAlt = images[safeIndex]?.altText || title;

  return (
    <div>
      <div className="relative overflow-hidden rounded-[16px] border border-border bg-image-well">
        <ProductImagePlaceholder
          seed={title}
          src={activeUrl}
          alt={activeAlt}
          fit="contain"
          className="aspect-square size-full rounded-none"
        />
        {badge ? <div className="absolute left-4 top-4">{badge}</div> : null}
      </div>
      {gallery.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {gallery.map((url, index) => (
            <li key={`${url}-${index}`}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show photo ${index + 1} of ${gallery.length}`}
                aria-pressed={index === safeIndex}
                className={cn(
                  "overflow-hidden rounded-[10px] border bg-image-well p-1 transition-colors",
                  index === safeIndex ? "border-foreground" : "border-border hover:border-foreground/40",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-square w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
