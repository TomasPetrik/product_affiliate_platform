"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { disconnectTikTokAds } from "@/server/services/tiktok-ads-oauth.service";

export interface TikTokAdsActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function disconnectTikTokAdsAction(
  _prev: TikTokAdsActionState,
  _formData: FormData,
): Promise<TikTokAdsActionState> {
  const session = await requireAdminSession();

  try {
    await disconnectTikTokAds();
    await writeAuditLog({
      actor: session,
      action: "TIKTOK_ADS_DISCONNECTED",
      entityType: "TikTokAdsOAuthConnection",
      entityId: "default",
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: "TikTok Ads disconnected." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to disconnect TikTok Ads.",
    };
  }
}
