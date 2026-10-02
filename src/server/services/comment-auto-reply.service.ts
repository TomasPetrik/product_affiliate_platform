import { prisma } from "@/lib/prisma";

import type { CommentAutoReplyRuleInput } from "@/server/validations/comment-auto-reply.schema";

export {
  buildCommentAutoReplyBody,
  commentContainsKeyword,
  DEFAULT_DM_REPLY_MESSAGE,
  DEFAULT_PUBLIC_REPLY_MESSAGE,
} from "@/server/services/comment-auto-reply.helpers";

export async function listCommentAutoReplyRulesForProduct(productId: string) {
  return prisma.commentAutoReplyRule.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createCommentAutoReplyRule(input: CommentAutoReplyRuleInput) {
  return prisma.commentAutoReplyRule.create({
    data: {
      productId: input.productId,
      keyword: input.keyword.trim(),
      publicReplyMessage: input.publicReplyMessage.trim(),
      dmReplyMessage: input.dmReplyMessage.trim(),
      replyUrl: input.replyUrl.trim(),
      enablePublicReply: input.enablePublicReply,
      enablePrivateDm: input.enablePrivateDm,
      enableInstagram: input.enableInstagram,
      enableFacebook: input.enableFacebook,
      isActive: input.isActive,
    },
  });
}

export async function updateCommentAutoReplyRule(
  ruleId: string,
  productId: string,
  input: Omit<CommentAutoReplyRuleInput, "productId">,
) {
  const existing = await prisma.commentAutoReplyRule.findFirst({
    where: { id: ruleId, productId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Rule not found.");
  }

  return prisma.commentAutoReplyRule.update({
    where: { id: ruleId },
    data: {
      keyword: input.keyword.trim(),
      publicReplyMessage: input.publicReplyMessage.trim(),
      dmReplyMessage: input.dmReplyMessage.trim(),
      replyUrl: input.replyUrl.trim(),
      enablePublicReply: input.enablePublicReply,
      enablePrivateDm: input.enablePrivateDm,
      enableInstagram: input.enableInstagram,
      enableFacebook: input.enableFacebook,
      isActive: input.isActive,
    },
  });
}

export async function deleteCommentAutoReplyRule(ruleId: string, productId: string) {
  const existing = await prisma.commentAutoReplyRule.findFirst({
    where: { id: ruleId, productId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Rule not found.");
  }

  await prisma.commentAutoReplyRule.delete({ where: { id: ruleId } });
}

export async function setCommentAutoReplyRuleActive(
  ruleId: string,
  productId: string,
  isActive: boolean,
) {
  const existing = await prisma.commentAutoReplyRule.findFirst({
    where: { id: ruleId, productId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Rule not found.");
  }

  return prisma.commentAutoReplyRule.update({
    where: { id: ruleId },
    data: { isActive },
  });
}
