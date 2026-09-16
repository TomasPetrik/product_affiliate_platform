export const LOCAL_PRODUCT_UPLOAD_PREFIX = "/uploads/products/";

/** Max upload size for product hero / gallery images. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export type ProductImageVariant = "full" | "md" | "sm";

const VARIANT_SUFFIX: Record<Exclude<ProductImageVariant, "full">, string> = {
  sm: "-sm",
  md: "-md",
};

export function isLocalProductUpload(url: string): boolean {
  return url.startsWith(LOCAL_PRODUCT_UPLOAD_PREFIX) && !url.includes("..") && !url.includes("\\");
}

/**
 * Derives a thumbnail/list variant path from a stored product image URL.
 * Local uploads created by `storeUploadedProductImage` always have `-sm` / `-md`
 * WebP siblings. Remote marketplace URLs are returned unchanged.
 */
export function productImageVariantPath(
  url: string | null | undefined,
  variant: ProductImageVariant = "full",
): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (variant === "full" || !isLocalProductUpload(trimmed)) {
    return trimmed;
  }

  // Already a variant URL — normalize back to full first.
  const fullPath = trimmed.replace(/-(sm|md)(\.[a-z0-9]+)$/i, "$2");
  const suffix = VARIANT_SUFFIX[variant];
  const dot = fullPath.lastIndexOf(".");
  if (dot <= 0) {
    return `${fullPath}${suffix}.webp`;
  }

  return `${fullPath.slice(0, dot)}${suffix}.webp`;
}

/** Prefer a list-friendly thumbnail; fall back to the stored URL. */
export function productListImageUrl(url: string | null | undefined): string | null {
  return productImageVariantPath(url, "md") ?? url ?? null;
}

export function productThumbImageUrl(url: string | null | undefined): string | null {
  return productImageVariantPath(url, "sm") ?? url ?? null;
}
