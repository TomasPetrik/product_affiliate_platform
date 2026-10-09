import {
  buildCommentAutoReplyBody,
  commentContainsKeyword,
} from "@/server/services/comment-auto-reply.helpers";

export interface TikTokCommentDemoProduct {
  id: string;
  title: string;
  slug: string;
  publicId: number;
  productUrl: string;
  hopUrl: string;
  tiktokAccountHint: string;
  rules: Array<{
    id: string;
    keyword: string;
    publicReplyMessage: string;
    dmReplyMessage: string;
    replyUrl: string;
    enablePublicReply: boolean;
    enablePrivateDm: boolean;
    isActive: boolean;
  }>;
  linkedTikTokPosts: Array<{
    externalId: string;
    permalinkUrl: string | null;
  }>;
}

export interface TikTokCommentDemoSimulation {
  matched: boolean;
  productId: string | null;
  productTitle: string | null;
  keyword: string | null;
  publicReply: string | null;
  dmReply: string | null;
  productUrl: string | null;
  hopUrl: string | null;
  reason: string;
}

export function simulateTikTokKeywordMatch(
  product: TikTokCommentDemoProduct,
  commentText: string,
): TikTokCommentDemoSimulation {
  const activeRules = product.rules.filter((rule) => rule.isActive);
  if (activeRules.length === 0) {
    return {
      matched: false,
      productId: product.id,
      productTitle: product.title,
      keyword: null,
      publicReply: null,
      dmReply: null,
      productUrl: product.productUrl,
      hopUrl: product.hopUrl,
      reason: "No active TikTok keyword rules on this product. Enable TikTok on a rule first.",
    };
  }

  const matched = activeRules.find((rule) => commentContainsKeyword(commentText, rule.keyword));
  if (!matched) {
    return {
      matched: false,
      productId: product.id,
      productTitle: product.title,
      keyword: null,
      publicReply: null,
      dmReply: null,
      productUrl: product.productUrl,
      hopUrl: product.hopUrl,
      reason: `Comment did not match keywords: ${activeRules.map((r) => r.keyword).join(", ")}`,
    };
  }

  return {
    matched: true,
    productId: product.id,
    productTitle: product.title,
    keyword: matched.keyword,
    publicReply: matched.enablePublicReply ? matched.publicReplyMessage.trim() : null,
    dmReply: matched.enablePrivateDm
      ? buildCommentAutoReplyBody(matched.dmReplyMessage, matched.replyUrl || product.hopUrl)
      : null,
    productUrl: product.productUrl,
    hopUrl: matched.replyUrl || product.hopUrl,
    reason: `Matched keyword “${matched.keyword}” → product ${product.title}`,
  };
}
