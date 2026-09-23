import { prisma } from "@/lib/prisma";
import { formatIsoDate } from "@/lib/date-range";
import {
  fetchPlatformViewCount,
  isPlatformSyncConfigured,
  PlatformSyncError,
} from "@/server/services/social-platform-views.service";

export interface MarketingVideoSyncSummary {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: Array<{ postId: string; platform: string; message: string }>;
}

/**
 * Pull lifetime view counts from each platform and store a UTC-day snapshot
 * so product analytics can compute views gained inside a date range.
 */
export async function syncMarketingVideoPosts(options?: {
  productId?: string;
  marketingVideoId?: string;
  postId?: string;
}): Promise<MarketingVideoSyncSummary> {
  const posts = await prisma.productMarketingVideoPost.findMany({
    where: {
      ...(options?.postId ? { id: options.postId } : {}),
      ...(options?.marketingVideoId ? { marketingVideoId: options.marketingVideoId } : {}),
      ...(options?.productId
        ? { marketingVideo: { productId: options.productId } }
        : {}),
    },
    select: {
      id: true,
      platform: true,
      externalId: true,
    },
  });

  const summary: MarketingVideoSyncSummary = {
    total: posts.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const today = new Date(`${formatIsoDate(new Date())}T00:00:00.000Z`);

  for (const post of posts) {
    if (!(await isPlatformSyncConfigured(post.platform))) {
      summary.skipped += 1;
      await prisma.productMarketingVideoPost.update({
        where: { id: post.id },
        data: {
          syncStatus: "ERROR",
          lastSyncError: `${post.platform} API credentials are not configured on this server.`,
        },
      });
      summary.errors.push({
        postId: post.id,
        platform: post.platform,
        message: "API credentials not configured",
      });
      continue;
    }

    try {
      const result = await fetchPlatformViewCount(post.platform, post.externalId);
      const viewCount = BigInt(result.viewCount);

      await prisma.$transaction([
        prisma.productMarketingVideoPost.update({
          where: { id: post.id },
          data: {
            viewCount,
            permalinkUrl: result.permalinkUrl ?? undefined,
            lastSyncedAt: new Date(),
            syncStatus: "OK",
            lastSyncError: null,
          },
        }),
        prisma.productMarketingVideoPostSnapshot.upsert({
          where: {
            postId_day: { postId: post.id, day: today },
          },
          create: {
            postId: post.id,
            day: today,
            viewCount,
          },
          update: {
            viewCount,
          },
        }),
      ]);

      summary.synced += 1;
    } catch (error) {
      summary.failed += 1;
      const message =
        error instanceof PlatformSyncError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown sync error";

      await prisma.productMarketingVideoPost.update({
        where: { id: post.id },
        data: {
          syncStatus: "ERROR",
          lastSyncError: message.slice(0, 500),
          lastSyncedAt: new Date(),
        },
      });

      summary.errors.push({
        postId: post.id,
        platform: post.platform,
        message,
      });
    }
  }

  return summary;
}
