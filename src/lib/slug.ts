const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export function uniqueSlugCandidate(base: string, attempt: number): string {
  if (attempt <= 1) {
    return base;
  }
  const suffix = `-${attempt}`;
  return `${base.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`;
}
