import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { syncMarketingVideoPosts } from "@/server/services/marketing-video-sync.service";

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
 * Pull Instagram / Facebook / YouTube / TikTok view counts for linked marketing videos.
 *
 * VPS crontab example (daily):
 *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *     https://radarcut.com/api/cron/marketing-video-sync
 */
export async function POST(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncMarketingVideoPosts();
    return Response.json(
      { ok: true, ...summary },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketing video sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(
    {
      ok: true,
      message: "POST to this endpoint to sync marketing video view counts.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
