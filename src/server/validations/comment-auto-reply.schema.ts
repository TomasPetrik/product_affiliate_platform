import { z } from "zod";

import { isHttpUrl } from "@/lib/approved-image-url";

export const commentAutoReplyRuleSchema = z
  .object({
    productId: z.string().trim().min(1, "Product is required"),
    keyword: z
      .string()
      .trim()
      .min(1, "Keyword is required")
      .max(80, "Keyword must be at most 80 characters"),
    publicReplyMessage: z
      .string()
      .trim()
      .max(400, "Public comment message must be at most 400 characters"),
    dmReplyMessage: z
      .string()
      .trim()
      .max(400, "DM message must be at most 400 characters"),
    replyUrl: z
      .string()
      .trim()
      .min(1, "Product URL is required")
      .max(2000, "Product URL must be at most 2000 characters")
      .refine(isHttpUrl, "Product URL must be an http(s) link"),
    enablePublicReply: z.boolean(),
    enablePrivateDm: z.boolean(),
    enableInstagram: z.boolean(),
    enableFacebook: z.boolean(),
    enableTikTok: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.enableInstagram && !value.enableFacebook && !value.enableTikTok) {
      ctx.addIssue({
        code: "custom",
        message: "Enable at least Instagram, Facebook, or TikTok.",
        path: ["enableInstagram"],
      });
    }
    if (!value.enablePublicReply && !value.enablePrivateDm) {
      ctx.addIssue({
        code: "custom",
        message: "Enable at least a public comment reply or a private DM.",
        path: ["enablePublicReply"],
      });
    }
    if (value.enablePublicReply && !value.publicReplyMessage.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Public comment message is required when public replies are enabled.",
        path: ["publicReplyMessage"],
      });
    }
    if (value.enablePrivateDm && !value.dmReplyMessage.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "DM message is required when private DMs are enabled.",
        path: ["dmReplyMessage"],
      });
    }
  });

export type CommentAutoReplyRuleInput = z.infer<typeof commentAutoReplyRuleSchema>;
