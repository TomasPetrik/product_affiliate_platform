/** Instagram-friendly short product path: /p/42 → redirects to /products/{slug}. */
export function productShortPath(publicId: number): string {
  return `/p/${publicId}`;
}

export function parseProductPublicId(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}
