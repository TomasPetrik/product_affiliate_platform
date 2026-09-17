import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { runAnalyticsRetention } from "@/server/services/analytics-retention.service";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const query = new URL(request.url).searchParams.get("secret")?.trim() ?? "";
  const provided = bearer || query;
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Daily rollup + raw-event retention.
 *
 * VPS crontab example (once a day):
 *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://radarcut.com/api/cron/analytics-retention
 */
export async function POST(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAnalyticsRetention();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analytics retention failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
