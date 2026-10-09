"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { disconnectTikTokAccount } from "@/server/services/tiktok-account-oauth.service";

export interface TikTokAccountActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function disconnectTikTokAccountAction(
  _prev: TikTokAccountActionState,
  _formData: FormData,
): Promise<TikTokAccountActionState> {
  const session = await requireAdminSession();

  try {
    await disconnectTikTokAccount();
    await writeAuditLog({
      actor: session,
      action: "TIKTOK_ACCOUNT_DISCONNECTED",
      entityType: "TikTokAccountOAuthConnection",
      entityId: "default",
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: "TikTok Account disconnected." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to disconnect TikTok Account.",
    };
  }
}
