import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { metaGraphUrl } from "@/lib/meta";
import {
  getMetaConnectionInternal,
  getValidMetaPageAccessToken,
} from "@/server/services/meta-oauth.service";

export class MetaCommentReplyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "MetaCommentReplyError";
  }
}

async function graphPostJson<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const url = metaGraphUrl(path, { access_token: accessToken });
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new MetaCommentReplyError(
      error instanceof Error ? error.message : "Network error contacting Meta Graph API",
      "network_error",
    );
  }

  let data: T & { error?: { message?: string; code?: number; type?: string } };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new MetaCommentReplyError(
      `Invalid JSON from Meta (HTTP ${response.status})`,
      "invalid_response",
    );
  }

  if (!response.ok || data.error) {
    throw new MetaCommentReplyError(
      data.error?.message ?? `Meta Graph error HTTP ${response.status}`,
      String(data.error?.code ?? response.status),
    );
  }

  return data;
}

async function resolvePageIdForMessaging(): Promise<string> {
  const connection = await getMetaConnectionInternal();
  if (connection?.status === "CONNECTED" && connection.pageId) {
    return connection.pageId;
  }
  if (env.META_PAGE_ID?.trim()) {
    return env.META_PAGE_ID.trim();
  }
  throw new MetaCommentReplyError(
    "No Facebook Page ID available for private replies. Connect Meta or set META_PAGE_ID.",
    "missing_page_id",
  );
}

/**
 * Send a private DM to the person who left the comment.
 * Instagram + Facebook Page comments both use Messenger private replies:
 *   POST /{page-id}/messages  { recipient: { comment_id }, message: { text } }
 * Requires pages_messaging. One private reply per comment.
 *
 * Facebook's legacy /{comment-id}/private_replies often fails for Reel comments
 * with "Object does not exist / does not support this operation".
 */
export async function sendPrivateReplyToComment(
  commentId: string,
  message: string,
  _platform: "INSTAGRAM" | "FACEBOOK" = "INSTAGRAM",
): Promise<string> {
  const token = await getValidMetaPageAccessToken();
  const pageId = await resolvePageIdForMessaging();

  const commentIdCandidates = [commentId];
  // Webhooks sometimes send "{postId}_{commentId}" without the page prefix;
  // Messenger occasionally wants "{pageId}_{postId}_{commentId}".
  if (pageId && !commentId.startsWith(`${pageId}_`)) {
    commentIdCandidates.push(`${pageId}_${commentId}`);
  }

  let lastError: MetaCommentReplyError | null = null;

  for (const candidate of commentIdCandidates) {
    try {
      const data = await graphPostJson<{ message_id?: string; recipient_id?: string }>(
        `/${pageId}/messages`,
        token,
        {
          recipient: { comment_id: candidate },
          message: { text: message },
        },
      );

      if (!data.message_id && !data.recipient_id) {
        lastError = new MetaCommentReplyError(
          "Private reply response missing message_id",
          "missing_id",
        );
        continue;
      }

      return data.message_id ?? data.recipient_id!;
    } catch (error) {
      lastError =
        error instanceof MetaCommentReplyError
          ? error
          : new MetaCommentReplyError(
              error instanceof Error ? error.message : "Private reply failed",
              "private_reply_failed",
            );
    }
  }

  throw lastError ?? new MetaCommentReplyError("Private reply failed", "private_reply_failed");
}

/** @deprecated Prefer sendPrivateReplyToComment for DMs; still used for public thread replies. */
export async function replyToInstagramComment(commentId: string, message: string): Promise<string> {
  const token = await getValidMetaPageAccessToken();
  const data = await graphPostJson<{ id?: string }>(`/${commentId}/replies`, token, { message });
  if (!data.id) {
    throw new MetaCommentReplyError("Instagram reply response missing id", "missing_id");
  }
  return data.id;
}

/** @deprecated Prefer sendPrivateReplyToComment — kept for optional public thread replies. */
export async function replyToFacebookComment(commentId: string, message: string): Promise<string> {
  const token = await getValidMetaPageAccessToken();
  const data = await graphPostJson<{ id?: string }>(`/${commentId}/comments`, token, { message });
  if (!data.id) {
    throw new MetaCommentReplyError("Facebook reply response missing id", "missing_id");
  }
  return data.id;
}

/** Verify Meta `X-Hub-Signature-256` using the app secret. */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
