const WINDOW_MS = 60_000;
const MAX_EVENTS = 60;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 2_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * In-memory sliding window for the public beacon.
 * Returns true when the request is allowed.
 */
export function consumeAnalyticsRateLimit(key: string, now = Date.now(), limit = MAX_EVENTS, windowMs = WINDOW_MS): boolean {
  const normalized = key.trim() || "anonymous";
  prune(now);

  const existing = buckets.get(normalized);
  if (!existing || existing.resetAt <= now) {
    buckets.set(normalized, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function resetAnalyticsRateLimitForTests() {
  buckets.clear();
}

export function analyticsRateLimitKey(visitorId: string | null | undefined, ip: string | null | undefined): string {
  return `vid:${visitorId?.trim() || "new"}|ip:${ip?.trim() || "unknown"}`;
}
