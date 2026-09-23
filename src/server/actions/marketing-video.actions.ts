"use server";

import { revalidatePath } from "next/cache";

import type { SocialPlatform } from "@/generated/prisma/enums";
import { requireAdminSession } from "@/lib/auth";
import { SOCIAL_PLATFORMS } from "@/lib/social-external-id";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  addMarketingVideoPost,
  deleteMarketingVideo,
  deleteMarketingVideoPost,
  saveMarketingVideo,
  updateMarketingVideoLabel,
} from "@/server/services/marketing-video.service";
import { syncMarketingVideoPosts } from "@/server/services/marketing-video-sync.service";

export interface MarketingVideoActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

function revalidateProduct(productId: string): void {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath(`/admin/products/${productId}/analytics`);
}

function readPlatformPosts(formData: FormData): Array<{
  platform: SocialPlatform;
  externalIdOrUrl: string;
  permalinkUrl?: string | null;
}> {
  const posts: Array<{
    platform: SocialPlatform;
    externalIdOrUrl: string;
    permalinkUrl?: string | null;
  }> = [];

  for (const platform of SOCIAL_PLATFORMS) {
    const raw = formData.get(`post_${platform}`);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    const permalinkRaw = formData.get(`permalink_${platform}`);
    posts.push({
      platform,
      externalIdOrUrl: value,
      permalinkUrl: typeof permalinkRaw === "string" ? permalinkRaw : null,
    });
  }

  return posts;
}

export async function saveMarketingVideoAction(
  _prev: MarketingVideoActionState,
  formData: FormData,
): Promise<MarketingVideoActionState> {
  const session = await requireAdminSession();

  const productId = String(formData.get("productId") ?? "");
  if (!productId) {
    return { error: "Missing product." };
  }

  try {
    const video = await saveMarketingVideo({
      productId,
      utmCampaign: String(formData.get("utmCampaign") ?? ""),
      posts: readPlatformPosts(formData),
    });

    await writeAuditLog({
      actor: session,
      action: "MARKETING_VIDEO_CREATED",
      entityType: "ProductMarketingVideo",
      entityId: video.id,
      after: { productId, title: video.title, platforms: video.posts.map((p) => p.platform) },
    });

    // Best-effort immediate sync so the funnel is not empty until cron runs.
    await syncMarketingVideoPosts({ marketingVideoId: video.id });

    revalidateProduct(productId);
    return {
      ok: true,
      message: `Saved as “${video.title}”. View counts syncing.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save marketing video.",
    };
  }
}

export async function updateMarketingVideoLabelAction(
  _prev: MarketingVideoActionState,
  formData: FormData,
): Promise<MarketingVideoActionState> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const videoId = String(formData.get("videoId") ?? "");
  const title = String(formData.get("title") ?? "");
  if (!productId || !videoId) {
    return { error: "Missing product or video." };
  }

  try {
    const video = await updateMarketingVideoLabel(videoId, productId, title);
    await writeAuditLog({
      actor: session,
      action: "MARKETING_VIDEO_LABEL_UPDATED",
      entityType: "ProductMarketingVideo",
      entityId: videoId,
      after: { productId, title: video.title },
    });
    revalidateProduct(productId);
    return { ok: true, message: `Label updated to “${video.title}”.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update label.",
    };
  }
}

export async function addMarketingVideoPostAction(
  _prev: MarketingVideoActionState,
  formData: FormData,
): Promise<MarketingVideoActionState> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const videoId = String(formData.get("videoId") ?? "");
  const platformRaw = String(formData.get("platform") ?? "").toUpperCase();
  const externalIdOrUrl = String(formData.get("externalIdOrUrl") ?? "");

  if (!productId || !videoId) {
    return { error: "Missing product or video." };
  }
  if (!SOCIAL_PLATFORMS.includes(platformRaw as SocialPlatform)) {
    return { error: "Pick a platform." };
  }

  try {
    const video = await addMarketingVideoPost(videoId, productId, {
      platform: platformRaw as SocialPlatform,
      externalIdOrUrl,
    });
    const added = video.posts.find((post) => post.platform === platformRaw);

    await writeAuditLog({
      actor: session,
      action: "MARKETING_VIDEO_POST_ADDED",
      entityType: "ProductMarketingVideo",
      entityId: videoId,
      after: { productId, platform: platformRaw, title: video.title },
    });

    if (added) {
      await syncMarketingVideoPosts({ postId: added.id });
    }

    revalidateProduct(productId);
    return {
      ok: true,
      message: `Added ${platformRaw}. Label is now “${video.title}”.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not add platform post.",
    };
  }
}

export async function deleteMarketingVideoAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const videoId = String(formData.get("videoId") ?? "");
  if (!productId || !videoId) return;

  await deleteMarketingVideo(videoId, productId);
  await writeAuditLog({
    actor: session,
    action: "MARKETING_VIDEO_DELETED",
    entityType: "ProductMarketingVideo",
    entityId: videoId,
    after: { productId },
  });
  revalidateProduct(productId);
}

export async function deleteMarketingVideoPostAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  if (!productId || !postId) return;

  await deleteMarketingVideoPost(postId, productId);
  await writeAuditLog({
    actor: session,
    action: "MARKETING_VIDEO_POST_DELETED",
    entityType: "ProductMarketingVideoPost",
    entityId: postId,
    after: { productId },
  });
  revalidateProduct(productId);
}

export async function syncMarketingVideoViewsAction(
  _prev: MarketingVideoActionState,
  formData: FormData,
): Promise<MarketingVideoActionState> {
  const session = await requireAdminSession();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) {
    return { error: "Missing product." };
  }

  try {
    const summary = await syncMarketingVideoPosts({ productId });
    await writeAuditLog({
      actor: session,
      action: "MARKETING_VIDEO_SYNCED",
      entityType: "Product",
      entityId: productId,
      after: summary,
    });
    revalidateProduct(productId);

    if (summary.total === 0) {
      return { ok: true, message: "No platform posts to sync." };
    }

    return {
      ok: true,
      message: `Synced ${summary.synced}/${summary.total} posts` +
        (summary.failed || summary.skipped
          ? ` (${summary.failed} failed, ${summary.skipped} skipped).`
          : "."),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Sync failed.",
    };
  }
}
