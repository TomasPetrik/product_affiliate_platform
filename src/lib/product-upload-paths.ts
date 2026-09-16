import path from "node:path";

/** On-disk root for product image uploads (outside `public/` so Next can serve them at runtime). */
export function productUploadsDir(): string {
  return path.join(process.cwd(), "storage", "uploads", "products");
}

/** Legacy location used before runtime upload serving was fixed. */
export function legacyPublicProductUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads", "products");
}
