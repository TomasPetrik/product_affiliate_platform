import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 8;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function storeUploadedProductImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (file.size <= 0) {
    return { error: "Uploaded image is empty." };
  }
  if (file.size > MAX_BYTES) {
    return { error: `"${file.name}" is larger than 2MB.` };
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { error: `"${file.name}" must be a JPEG, PNG, WebP, or GIF.` };
  }

  const filename = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  return { url: `/uploads/products/${filename}` };
}

export function listUploadedImageFiles(formData: FormData): File[] {
  return formData
    .getAll("imageFiles")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_FILES);
}
