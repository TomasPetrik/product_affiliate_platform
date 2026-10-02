export interface InboundMetaComment {
  platform: "INSTAGRAM" | "FACEBOOK";
  commentId: string;
  commentText: string;
  mediaExternalId: string;
  /** Extra IDs that may match a stored marketing-video post externalId. */
  mediaIdCandidates: string[];
  fromId: string | null;
  /** False when this is a reply-to-reply / nested comment. */
  isTopLevel: boolean;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: Record<string, unknown>;
    }>;
  }>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectMediaIdCandidates(...values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    out.add(value);
    const underscore = value.lastIndexOf("_");
    if (underscore > 0 && underscore < value.length - 1) {
      out.add(value.slice(underscore + 1));
    }
  }
  return [...out];
}

/**
 * Parse Meta webhook JSON into comment events we may auto-reply to.
 * Pure — no DB / env imports (safe for unit tests).
 */
export function parseMetaCommentWebhookPayload(payload: unknown): InboundMetaComment[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as MetaWebhookPayload;
  const events: InboundMetaComment[] = [];

  if (body.object === "instagram") {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "comments") continue;
        const value = change.value ?? {};
        const commentId = asString(value.id);
        const text = asString(value.text) ?? "";
        const media =
          value.media && typeof value.media === "object"
            ? (value.media as Record<string, unknown>)
            : null;
        const mediaId = asString(media?.id);
        if (!commentId || !mediaId) continue;

        const from =
          value.from && typeof value.from === "object"
            ? (value.from as Record<string, unknown>)
            : null;

        events.push({
          platform: "INSTAGRAM",
          commentId,
          commentText: text,
          mediaExternalId: mediaId,
          mediaIdCandidates: collectMediaIdCandidates(mediaId),
          fromId: asString(from?.id),
          isTopLevel: !asString(value.parent_id),
        });
      }
    }
  }

  if (body.object === "page") {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "feed") continue;
        const value = change.value ?? {};
        if (asString(value.item) !== "comment") continue;
        if (asString(value.verb) !== "add") continue;

        const commentId = asString(value.comment_id);
        const message = asString(value.message) ?? "";
        const postId = asString(value.post_id);
        const parentId = asString(value.parent_id);
        const videoId = asString(value.video_id);
        const photoId = asString(value.photo_id);
        const shareId = asString(value.share_id);
        if (!commentId || !postId) continue;

        const from =
          value.from && typeof value.from === "object"
            ? (value.from as Record<string, unknown>)
            : null;

        events.push({
          platform: "FACEBOOK",
          commentId,
          commentText: message,
          mediaExternalId: postId,
          mediaIdCandidates: collectMediaIdCandidates(postId, videoId, photoId, shareId),
          fromId: asString(from?.id),
          isTopLevel: !parentId || parentId === postId,
        });
      }
    }
  }

  return events;
}
