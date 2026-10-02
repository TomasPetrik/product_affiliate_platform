import {
  buildCommentAutoReplyBody,
  commentContainsKeyword,
} from "@/server/services/comment-auto-reply.helpers";
import { expandFacebookMediaIdCandidates } from "@/server/services/meta-facebook-media-ids";
import {
  MetaCommentReplyError,
  replyToFacebookComment,
  replyToInstagramComment,
  sendPrivateReplyToComment,
} from "@/server/services/meta-comment-reply.service";
import {
  parseMetaCommentWebhookPayload,
  type InboundMetaComment,
} from "@/server/services/meta-comment-webhook.parse";
import { getMetaConnectionInternal } from "@/server/services/meta-oauth.service";
import type { SocialPlatform } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type { InboundMetaComment } from "@/server/services/meta-comment-webhook.parse";
export { parseMetaCommentWebhookPayload } from "@/server/services/meta-comment-webhook.parse";

function idsMatch(storedExternalId: string, candidates: string[], permalinkUrl: string | null): boolean {
  const id = storedExternalId;
  if (candidates.includes(id)) return true;
  if (
    candidates.some(
      (candidate) =>
        candidate === id ||
        candidate.endsWith(`_${id}`) ||
        id.endsWith(`_${candidate}`) ||
        candidate.includes(id) ||
        id.includes(candidate),
    )
  ) {
    return true;
  }
  if (permalinkUrl) {
    return candidates.some((candidate) => candidate.length >= 5 && permalinkUrl.includes(candidate));
  }
  return false;
}

async function findLinkedMarketingPost(
  platform: SocialPlatform,
  mediaIdCandidates: string[],
) {
  if (mediaIdCandidates.length === 0) return null;

  const exact = await prisma.productMarketingVideoPost.findFirst({
    where: {
      platform,
      externalId: { in: mediaIdCandidates },
    },
    select: {
      id: true,
      externalId: true,
      permalinkUrl: true,
      marketingVideo: {
        select: {
          productId: true,
        },
      },
    },
  });
  if (exact) return exact;

  if (platform !== "FACEBOOK") return null;

  let candidates = mediaIdCandidates;
  try {
    candidates = await expandFacebookMediaIdCandidates(mediaIdCandidates);
  } catch {
    candidates = mediaIdCandidates;
  }

  const exactAfterExpand = await prisma.productMarketingVideoPost.findFirst({
    where: {
      platform: "FACEBOOK",
      externalId: { in: candidates },
    },
    select: {
      id: true,
      externalId: true,
      permalinkUrl: true,
      marketingVideo: { select: { productId: true } },
    },
  });
  if (exactAfterExpand) return exactAfterExpand;

  const posts = await prisma.productMarketingVideoPost.findMany({
    where: { platform: "FACEBOOK" },
    select: {
      id: true,
      externalId: true,
      permalinkUrl: true,
      marketingVideo: { select: { productId: true } },
    },
  });

  for (const post of posts) {
    if (idsMatch(post.externalId, candidates, post.permalinkUrl)) {
      return post;
    }
  }

  return null;
}

async function alreadyHandled(commentId: string): Promise<boolean> {
  const existing = await prisma.commentAutoReplyLog.findUnique({
    where: { commentId },
    select: { id: true },
  });
  return Boolean(existing);
}

async function writeLog(input: {
  ruleId?: string | null;
  productId: string;
  platform: SocialPlatform;
  mediaExternalId: string;
  commentId: string;
  commentText: string;
  replyCommentId?: string | null;
  replyBody?: string | null;
  status: "SUCCESS" | "SKIPPED" | "ERROR";
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await prisma.commentAutoReplyLog.create({
      data: {
        ruleId: input.ruleId ?? null,
        productId: input.productId,
        platform: input.platform,
        mediaExternalId: input.mediaExternalId,
        commentId: input.commentId,
        commentText: input.commentText.slice(0, 2000),
        replyCommentId: input.replyCommentId ?? null,
        replyBody: input.replyBody ?? null,
        status: input.status,
        errorMessage: input.errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch {
    // Unique race on commentId — another worker already logged this comment.
  }
}

export async function processInboundMetaComment(event: InboundMetaComment): Promise<void> {
  if (await alreadyHandled(event.commentId)) {
    return;
  }

  if (!event.isTopLevel) {
    return;
  }

  const connection = await getMetaConnectionInternal();
  if (connection?.status === "CONNECTED") {
    const selfIds = [
      connection.instagramBusinessAccountId,
      connection.pageId,
      connection.facebookUserId,
    ].filter(Boolean);
    if (event.fromId && selfIds.includes(event.fromId)) {
      return;
    }
  }

  const post = await findLinkedMarketingPost(event.platform, event.mediaIdCandidates);
  if (!post) {
    // Persist a diagnostic row against any product that has active FB/IG rules so
    // Admin → Settings shows why nothing fired (usually media ID mismatch on Facebook).
    const fallbackProduct = await prisma.commentAutoReplyRule.findFirst({
      where: {
        isActive: true,
        ...(event.platform === "INSTAGRAM"
          ? { enableInstagram: true }
          : { enableFacebook: true }),
      },
      select: { productId: true },
      orderBy: { createdAt: "asc" },
    });
    if (fallbackProduct) {
      await writeLog({
        productId: fallbackProduct.productId,
        platform: event.platform,
        mediaExternalId: event.mediaExternalId,
        commentId: event.commentId,
        commentText: event.commentText,
        status: "SKIPPED",
        errorMessage: `No linked marketing-video post matched media IDs: ${event.mediaIdCandidates.join(", ") || "(none)"}`,
      });
    }
    return;
  }

  const productId = post.marketingVideo.productId;
  const rules = await prisma.commentAutoReplyRule.findMany({
    where: {
      productId,
      isActive: true,
      ...(event.platform === "INSTAGRAM"
        ? { enableInstagram: true }
        : { enableFacebook: true }),
    },
    orderBy: { createdAt: "asc" },
  });

  const matched = rules.find((rule) => commentContainsKeyword(event.commentText, rule.keyword));
  if (!matched) {
    await writeLog({
      productId,
      platform: event.platform,
      mediaExternalId: post.externalId,
      commentId: event.commentId,
      commentText: event.commentText,
      status: "SKIPPED",
      errorMessage: `Linked post matched (${post.externalId}) but no active keyword matched “${event.commentText.slice(0, 80)}”`,
    });
    return;
  }

  if (!matched.enablePublicReply && !matched.enablePrivateDm) {
    await writeLog({
      ruleId: matched.id,
      productId,
      platform: event.platform,
      mediaExternalId: post.externalId,
      commentId: event.commentId,
      commentText: event.commentText,
      status: "SKIPPED",
      errorMessage: "Rule matched but both public comment and private DM are disabled",
    });
    return;
  }

  const publicBody = matched.publicReplyMessage.trim();
  const dmBody = buildCommentAutoReplyBody(matched.dmReplyMessage, matched.replyUrl);
  const replyParts: string[] = [];
  const replyIds: string[] = [];
  const errors: string[] = [];

  if (matched.enablePublicReply && publicBody) {
    try {
      const publicId =
        event.platform === "INSTAGRAM"
          ? await replyToInstagramComment(event.commentId, publicBody)
          : await replyToFacebookComment(event.commentId, publicBody);
      replyIds.push(`public:${publicId}`);
      replyParts.push(`public=${publicBody}`);
    } catch (error) {
      errors.push(
        `public: ${
          error instanceof MetaCommentReplyError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Public reply failed"
        }`,
      );
    }
  }

  if (matched.enablePrivateDm && dmBody) {
    try {
      const dmId = await sendPrivateReplyToComment(event.commentId, dmBody, event.platform);
      replyIds.push(`dm:${dmId}`);
      replyParts.push(`dm=${dmBody}`);
    } catch (error) {
      errors.push(
        `dm: ${
          error instanceof MetaCommentReplyError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Private DM failed"
        }`,
      );
    }
  }

  const anySuccess = replyIds.length > 0;
  await writeLog({
    ruleId: matched.id,
    productId,
    platform: event.platform,
    mediaExternalId: post.externalId,
    commentId: event.commentId,
    commentText: event.commentText,
    replyCommentId: replyIds.join(",") || null,
    replyBody: replyParts.join(" | ") || null,
    status: anySuccess ? "SUCCESS" : "ERROR",
    errorMessage: errors.length > 0 ? errors.join(" | ") : null,
  });
}

export async function handleMetaCommentWebhookPayload(payload: unknown): Promise<void> {
  const events = parseMetaCommentWebhookPayload(payload);
  for (const event of events) {
    await processInboundMetaComment(event);
  }
}
