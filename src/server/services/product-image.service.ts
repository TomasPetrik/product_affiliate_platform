import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  LOCAL_PRODUCT_UPLOAD_PREFIX,
  MAX_PRODUCT_IMAGE_BYTES,
  type ProductImageVariant,
  productImageVariantPath,
} from "@/lib/product-image-variants";
import { productUploadsDir } from "@/lib/product-upload-paths";

export { MAX_PRODUCT_IMAGE_BYTES };

const MAX_FILES = 8;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const VARIANT_WIDTHS: Record<Exclude<ProductImageVariant, "full">, number> = {
  sm: 320,
  md: 640,
};

const FULL_MAX_EDGE = 1600;

export interface StoredProductImage {
  url: string;
  variants: {
    sm: string;
    md: string;
  };
}

export async function storeUploadedProductImage(
  file: File,
): Promise<StoredProductImage | { error: string }> {
  if (file.size <= 0) {
    return { error: "Uploaded image is empty." };
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return { error: `"${file.name}" is larger than 5MB.` };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: `"${file.name}" must be a JPEG, PNG, WebP, or GIF.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await sharp(buffer, { animated: false }).metadata();
  } catch {
    return { error: `"${file.name}" could not be read as an image.` };
  }

  const id = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  const dir = productUploadsDir();
  await mkdir(dir, { recursive: true });

  const fullRelative = `${LOCAL_PRODUCT_UPLOAD_PREFIX}${id}.webp`;
  const smRelative = productImageVariantPath(fullRelative, "sm") ?? `${LOCAL_PRODUCT_UPLOAD_PREFIX}${id}-sm.webp`;
  const mdRelative = productImageVariantPath(fullRelative, "md") ?? `${LOCAL_PRODUCT_UPLOAD_PREFIX}${id}-md.webp`;

  try {
    const fullBuffer = await sharp(buffer, { animated: false })
      .rotate()
      .resize({
        width: FULL_MAX_EDGE,
        height: FULL_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    const smBuffer = await sharp(buffer, { animated: false })
      .rotate()
      .resize({
        width: VARIANT_WIDTHS.sm,
        height: VARIANT_WIDTHS.sm,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();

    const mdBuffer = await sharp(buffer, { animated: false })
      .rotate()
      .resize({
        width: VARIANT_WIDTHS.md,
        height: VARIANT_WIDTHS.md,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    await Promise.all([
      writeFile(path.join(dir, path.basename(fullRelative)), fullBuffer),
      writeFile(path.join(dir, path.basename(smRelative)), smBuffer),
      writeFile(path.join(dir, path.basename(mdRelative)), mdBuffer),
    ]);
  } catch {
    return { error: `Could not process "${file.name}". Try another image.` };
  }

  return {
    url: fullRelative,
    variants: { sm: smRelative, md: mdRelative },
  };
}

export function listUploadedImageFiles(formData: FormData): File[] {
  return formData
    .getAll("imageFiles")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_FILES);
}
