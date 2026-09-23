"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { disconnectTikTok } from "@/server/services/tiktok-oauth.service";
import { syncTikTokVideosAndMarketingPosts } from "@/server/services/tiktok-video.service";

export interface TikTokActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function disconnectTikTokAction(
  _prev: TikTokActionState,
  _formData: FormData,
): Promise<TikTokActionState> {
  const session = await requireAdminSession();

  try {
    await disconnectTikTok();
    await writeAuditLog({
      actor: session,
      action: "TIKTOK_DISCONNECTED",
      entityType: "TikTokOAuthConnection",
      entityId: "default",
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: "TikTok disconnected." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to disconnect TikTok.",
    };
  }
}

export async function syncTikTokVideosAction(
  _prev: TikTokActionState,
  _formData: FormData,
): Promise<TikTokActionState> {
  const session = await requireAdminSession();

  try {
    const summary = await syncTikTokVideosAndMarketingPosts();
    await writeAuditLog({
      actor: session,
      action: "TIKTOK_VIDEOS_SYNCED",
      entityType: "TikTokCachedVideo",
      entityId: "default",
      after: {
        listed: summary.listed,
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
      message: `Synced ${summary.cached} TikTok video(s); updated ${summary.marketingPostsUpdated} linked marketing post(s).`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to sync TikTok videos.",
    };
  }
}
