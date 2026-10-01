import type { SocialPlatform } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatIsoDate } from "@/lib/date-range";
import { SOCIAL_PLATFORMS } from "@/lib/social-external-id";
import {
  fetchPlatformViewCount,
  isPlatformSyncConfigured,
  PlatformSyncError,
} from "@/server/services/social-platform-views.service";

export interface MarketingVideoViewDelta {
  previous: number;
  current: number;
  delta: number;
}

export interface MarketingVideoProductViewDelta extends MarketingVideoViewDelta {
  productId: string;
  title: string;
  byPlatform: Record<SocialPlatform, MarketingVideoViewDelta>;
}

export interface MarketingVideoSyncSummary {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: Array<{ postId: string; platform: string; message: string }>;
  /** Lifetime view changes vs the count stored before this sync. */
  views: {
    total: MarketingVideoViewDelta;
    byPlatform: Record<SocialPlatform, MarketingVideoViewDelta>;
    byProduct: MarketingVideoProductViewDelta[];
  };
}

function emptyDelta(): MarketingVideoViewDelta {
  return { previous: 0, current: 0, delta: 0 };
}

function emptyPlatformDeltas(): Record<SocialPlatform, MarketingVideoViewDelta> {
  return Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, emptyDelta()])) as Record<
    SocialPlatform,
    MarketingVideoViewDelta
  >;
}

function addDelta(target: MarketingVideoViewDelta, previous: number, current: number): void {
  target.previous += previous;
  target.current += current;
  target.delta += current - previous;
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
      viewCount: true,
      marketingVideo: {
        select: {
          productId: true,
          product: { select: { title: true } },
        },
      },
    },
  });

  const summary: MarketingVideoSyncSummary = {
    total: posts.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    views: {
      total: emptyDelta(),
      byPlatform: emptyPlatformDeltas(),
      byProduct: [],
    },
  };

  const productDeltas = new Map<string, MarketingVideoProductViewDelta>();
  const today = new Date(`${formatIsoDate(new Date())}T00:00:00.000Z`);

  for (const post of posts) {
    const previous = Number(post.viewCount);
    const productId = post.marketingVideo.productId;
    const productTitle = post.marketingVideo.product.title;

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
      const current = Number(viewCount);

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

      addDelta(summary.views.total, previous, current);
      addDelta(summary.views.byPlatform[post.platform], previous, current);

      const existing = productDeltas.get(productId);
      if (existing) {
        addDelta(existing, previous, current);
        addDelta(existing.byPlatform[post.platform], previous, current);
      } else {
        const byPlatform = emptyPlatformDeltas();
        addDelta(byPlatform[post.platform], previous, current);
        productDeltas.set(productId, {
          productId,
          title: productTitle,
          previous,
          current,
          delta: current - previous,
          byPlatform,
        });
      }

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

  summary.views.byProduct = [...productDeltas.values()].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current,
  );

  return summary;
}
