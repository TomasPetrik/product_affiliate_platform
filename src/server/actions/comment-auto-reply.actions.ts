"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createCommentAutoReplyRule,
  deleteCommentAutoReplyRule,
  setCommentAutoReplyRuleActive,
  updateCommentAutoReplyRule,
} from "@/server/services/comment-auto-reply.service";
import { commentAutoReplyRuleSchema } from "@/server/validations/comment-auto-reply.schema";

export interface CommentAutoReplyActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

function revalidateProduct(productId: string): void {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
}

function readRuleFlags(formData: FormData) {
  return {
    enablePublicReply: formData.get("enablePublicReply") === "on",
    enablePrivateDm: formData.get("enablePrivateDm") === "on",
    enableInstagram: formData.get("enableInstagram") === "on",
    enableFacebook: formData.get("enableFacebook") === "on",
    enableTikTok: formData.get("enableTikTok") === "on",
    isActive: formData.get("isActive") === "on",
  };
}

function readRulePayload(formData: FormData, productId: string) {
  return commentAutoReplyRuleSchema.safeParse({
    productId,
    keyword: formData.get("keyword") ?? "",
    publicReplyMessage: formData.get("publicReplyMessage") ?? "",
    dmReplyMessage: formData.get("dmReplyMessage") ?? "",
    replyUrl: formData.get("replyUrl") ?? "",
    ...readRuleFlags(formData),
  });
}

export async function createCommentAutoReplyRuleAction(
  _prev: CommentAutoReplyActionState,
  formData: FormData,
): Promise<CommentAutoReplyActionState> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");

  const parsed = readRulePayload(formData, productId);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const rule = await createCommentAutoReplyRule(parsed.data);
    await writeAuditLog({
      actor: session,
      action: "COMMENT_AUTO_REPLY_RULE_CREATED",
      entityType: "CommentAutoReplyRule",
      entityId: rule.id,
      after: {
        productId: rule.productId,
        keyword: rule.keyword,
        enablePublicReply: rule.enablePublicReply,
        enablePrivateDm: rule.enablePrivateDm,
        enableInstagram: rule.enableInstagram,
        enableFacebook: rule.enableFacebook,
        enableTikTok: rule.enableTikTok,
      },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Auto-reply rule saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save rule." };
  }
}

export async function updateCommentAutoReplyRuleAction(
  _prev: CommentAutoReplyActionState,
  formData: FormData,
): Promise<CommentAutoReplyActionState> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");

  if (!ruleId) {
    return { error: "Missing rule." };
  }

  const parsed = readRulePayload(formData, productId);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const { productId: _ignored, ...data } = parsed.data;
    const rule = await updateCommentAutoReplyRule(ruleId, productId, data);
    await writeAuditLog({
      actor: session,
      action: "COMMENT_AUTO_REPLY_RULE_UPDATED",
      entityType: "CommentAutoReplyRule",
      entityId: rule.id,
      after: {
        keyword: rule.keyword,
        enablePublicReply: rule.enablePublicReply,
        enablePrivateDm: rule.enablePrivateDm,
        enableInstagram: rule.enableInstagram,
        enableFacebook: rule.enableFacebook,
        enableTikTok: rule.enableTikTok,
        isActive: rule.isActive,
      },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Rule updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update rule." };
  }
}

export async function deleteCommentAutoReplyRuleAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  if (!productId || !ruleId) return;

  await deleteCommentAutoReplyRule(ruleId, productId);
  await writeAuditLog({
    actor: session,
    action: "COMMENT_AUTO_REPLY_RULE_DELETED",
    entityType: "CommentAutoReplyRule",
    entityId: ruleId,
    after: { productId },
  });
  revalidateProduct(productId);
}

export async function toggleCommentAutoReplyRuleAction(
  _prev: CommentAutoReplyActionState,
  formData: FormData,
): Promise<CommentAutoReplyActionState> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const isActive = formData.get("isActive") === "on";

  if (!productId || !ruleId) {
    return { error: "Missing rule." };
  }

  try {
    const rule = await setCommentAutoReplyRuleActive(ruleId, productId, isActive);
    await writeAuditLog({
      actor: session,
      action: "COMMENT_AUTO_REPLY_RULE_TOGGLED",
      entityType: "CommentAutoReplyRule",
      entityId: rule.id,
      after: { isActive: rule.isActive },
    });
    revalidateProduct(productId);
    return { ok: true, message: rule.isActive ? "Rule enabled." : "Rule disabled." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update rule." };
  }
}
