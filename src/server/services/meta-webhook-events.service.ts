import { prisma } from "@/lib/prisma";
import { parseMetaCommentWebhookPayload } from "@/server/services/meta-comment-webhook.parse";

const MAX_STORED_EVENTS = 40;

function summarizeWebhookPayload(payload: unknown): {
  object: string | null;
  fields: string | null;
  summary: string;
  eventCount: number;
  commentEventCount: number;
} {
  if (!payload || typeof payload !== "object") {
    return {
      object: null,
      fields: null,
      summary: "Received webhook with empty or invalid JSON body",
      eventCount: 0,
      commentEventCount: 0,
    };
  }

  const body = payload as {
    object?: unknown;
    entry?: unknown[];
  };
  const object = typeof body.object === "string" ? body.object : null;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const fieldSet = new Set<string>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const field = (change as { field?: unknown }).field;
      if (typeof field === "string" && field.trim()) {
        fieldSet.add(field.trim());
      }
    }
  }

  const fields = fieldSet.size > 0 ? [...fieldSet].sort().join(",") : null;
  const commentEvents = parseMetaCommentWebhookPayload(payload);
  const commentEventCount = commentEvents.length;

  let summary: string;
  if (commentEventCount > 0) {
    const sample = commentEvents[0];
    const mediaHint =
      sample?.mediaIdCandidates?.length
        ? ` media=[${sample.mediaIdCandidates.slice(0, 4).join(",")}]`
        : "";
    summary = `Received ${commentEventCount} comment event(s) on ${object ?? "unknown"} (${sample?.platform}: “${(sample?.commentText || "").slice(0, 80)}”)${mediaHint}`;
  } else if (object || fields) {
    summary = `Received webhook object=${object ?? "?"} fields=${fields ?? "none"} (${entries.length} entry(ies)) — no comment events parsed`;
  } else {
    summary = `Received webhook (${entries.length} entry(ies)) — no comment events parsed`;
  }

  return {
    object,
    fields,
    summary,
    eventCount: entries.length,
    commentEventCount,
  };
}

export async function recordMetaWebhookEvent(input: {
  payload: unknown;
  signatureOk: boolean;
}): Promise<void> {
  const parsed = summarizeWebhookPayload(input.payload);
  const summary = input.signatureOk
    ? parsed.summary
    : `Rejected: invalid X-Hub-Signature-256 — ${parsed.summary}`;

  await prisma.metaWebhookEvent.create({
    data: {
      object: parsed.object,
      fields: parsed.fields,
      summary: summary.slice(0, 500),
      eventCount: parsed.eventCount,
      commentEventCount: parsed.commentEventCount,
      signatureOk: input.signatureOk,
    },
  });

  const stale = await prisma.metaWebhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    skip: MAX_STORED_EVENTS,
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.metaWebhookEvent.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });
  }
}

export async function listRecentMetaWebhookEvents(limit = 15) {
  return prisma.metaWebhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listRecentCommentAutoReplyLogs(limit = 15) {
  return prisma.commentAutoReplyLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      product: { select: { id: true, title: true } },
      rule: { select: { id: true, keyword: true } },
    },
  });
}
