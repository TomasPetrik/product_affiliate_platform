"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { disconnectMeta } from "@/server/services/meta-oauth.service";
import { syncMetaMediaAndMarketingPosts } from "@/server/services/meta-media.service";

export interface MetaActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function disconnectMetaAction(
  _prev: MetaActionState,
  _formData: FormData,
): Promise<MetaActionState> {
  const session = await requireAdminSession();

  try {
    await disconnectMeta();
    await writeAuditLog({
      actor: session,
      action: "META_DISCONNECTED",
      entityType: "MetaOAuthConnection",
      entityId: "default",
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: "Meta disconnected." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to disconnect Meta.",
    };
  }
}

export async function syncMetaMediaAction(
  _prev: MetaActionState,
  _formData: FormData,
): Promise<MetaActionState> {
  const session = await requireAdminSession();

  try {
    const summary = await syncMetaMediaAndMarketingPosts();
    await writeAuditLog({
      actor: session,
      action: "META_MEDIA_SYNCED",
      entityType: "MetaCachedMedia",
      entityId: "default",
      after: {
        instagramListed: summary.instagramListed,
        facebookListed: summary.facebookListed,
        cached: summary.cached,
        marketingPostsUpdated: summary.marketingPostsUpdated,
        failed: summary.failed,
      },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/products");

    if (summary.error) {
      return { error: summary.error };
    }

    return {
      ok: true,
      message: `Synced ${summary.instagramListed} IG + ${summary.facebookListed} FB media; updated ${summary.marketingPostsUpdated} linked marketing post(s).`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to sync Meta media.",
    };
  }
}
