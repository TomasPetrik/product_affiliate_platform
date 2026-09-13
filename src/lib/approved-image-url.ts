const LOCAL_UPLOAD_PREFIX = "/uploads/products/";
const MAX_URL_LENGTH = 2000;

/**
 * Image URLs an admin is allowed to attach to a product.
 *
 * Accepted:
 * - `https://` URLs (no credentials) — treated as admin-approved remote assets
 * - local upload paths written by `storeUploadedProductImage`
 *
 * Rejected: `http://`, `javascript:`, `data:`, protocol-relative, and
 * anything with `..` path traversal.
 */
export function isApprovedImageUrl(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return false;
  }

  if (trimmed.startsWith(LOCAL_UPLOAD_PREFIX)) {
    return !trimmed.includes("..") && !trimmed.includes("\\") && !trimmed.includes("?");
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return false;
    }
    if (url.username || url.password) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
