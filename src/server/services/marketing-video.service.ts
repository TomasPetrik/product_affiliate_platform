import type { SocialPlatform } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  autoLabelFromPlatforms,
  parseSocialExternalId,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
} from "@/lib/social-external-id";
import type { ResolvedDateRange } from "@/lib/date-range";
import { formatIsoDate } from "@/lib/date-range";

export interface MarketingVideoPostInput {
  platform: SocialPlatform;
  externalIdOrUrl: string;
  permalinkUrl?: string | null;
}

export interface SaveMarketingVideoInput {
  productId: string;
  utmCampaign?: string | null;
  posts: MarketingVideoPostInput[];
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export { autoLabelFromPlatforms };

export interface ProductMarketingViewTotals {
  total: number;
  INSTAGRAM: number;
  FACEBOOK: number;
  YOUTUBE: number;
  TIKTOK: number;
}

const EMPTY_PLATFORM_VIEWS: ProductMarketingViewTotals = {
  total: 0,
  INSTAGRAM: 0,
  FACEBOOK: 0,
  YOUTUBE: 0,
  TIKTOK: 0,
};

/** Lifetime synced view counts from linked marketing posts, keyed by product id. */
export async function getMarketingViewsByProductIds(
  productIds: string[],
): Promise<Map<string, ProductMarketingViewTotals>> {
  const result = new Map<string, ProductMarketingViewTotals>();
  if (productIds.length === 0) return result;

  const rows = await prisma.productMarketingVideoPost.findMany({
    where: { marketingVideo: { productId: { in: productIds } } },
    select: {
      platform: true,
      viewCount: true,
      marketingVideo: { select: { productId: true } },
    },
  });

  for (const row of rows) {
    const productId = row.marketingVideo.productId;
    const current = result.get(productId) ?? { ...EMPTY_PLATFORM_VIEWS };
    const count = Number(row.viewCount);
    current[row.platform] += count;
    current.total += count;
    result.set(productId, current);
  }

  return result;
}

function normalizePosts(posts: MarketingVideoPostInput[]) {
  const platforms = new Set<SocialPlatform>();
  const normalizedPosts: Array<{
    platform: SocialPlatform;
    externalId: string;
    permalinkUrl: string | null;
  }> = [];

  for (const post of posts) {
    if (!SOCIAL_PLATFORMS.includes(post.platform)) {
      throw new Error(`Unknown platform: ${post.platform}`);
    }
    if (platforms.has(post.platform)) {
      throw new Error(`Duplicate platform ${post.platform}. One post per platform per video.`);
    }
    platforms.add(post.platform);

    const parsed = parseSocialExternalId(post.platform, post.externalIdOrUrl);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    normalizedPosts.push({
      platform: post.platform,
      externalId: parsed.externalId,
      permalinkUrl: blankToNull(post.permalinkUrl),
    });
  }

  return normalizedPosts;
}

export async function listMarketingVideosForProduct(productId: string) {
  return prisma.productMarketingVideo.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: {
      posts: {
        orderBy: { platform: "asc" },
      },
    },
  });
}

export async function saveMarketingVideo(input: SaveMarketingVideoInput) {
  if (input.posts.length === 0) {
    throw new Error("Add at least one platform post (Instagram, Facebook, YouTube, or TikTok).");
  }

  const normalizedPosts = normalizePosts(input.posts);
  const title = autoLabelFromPlatforms(normalizedPosts.map((post) => post.platform));

  return prisma.productMarketingVideo.create({
    data: {
      productId: input.productId,
      title,
      utmCampaign: blankToNull(input.utmCampaign),
      posts: {
        create: normalizedPosts.map((post) => ({
          platform: post.platform,
          externalId: post.externalId,
          permalinkUrl: post.permalinkUrl,
        })),
      },
    },
    include: { posts: true },
  });
}

export async function updateMarketingVideoLabel(
  videoId: string,
  productId: string,
  title: string,
) {
  const existing = await prisma.productMarketingVideo.findFirst({
    where: { id: videoId, productId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Marketing video not found.");
  }

  const nextTitle = blankToNull(title);
  if (!nextTitle) {
    throw new Error("Label cannot be empty.");
  }

  return prisma.productMarketingVideo.update({
    where: { id: videoId },
    data: { title: nextTitle },
    include: { posts: true },
  });
}

export async function addMarketingVideoPost(
  videoId: string,
  productId: string,
  post: MarketingVideoPostInput,
) {
  const existing = await prisma.productMarketingVideo.findFirst({
    where: { id: videoId, productId },
    include: { posts: { select: { platform: true } } },
  });
  if (!existing) {
    throw new Error("Marketing video not found.");
  }

  if (existing.posts.some((row) => row.platform === post.platform)) {
    throw new Error(`${SOCIAL_PLATFORM_LABELS[post.platform]} is already linked on this video.`);
  }

  const [normalized] = normalizePosts([post]);
  const previousPlatforms = existing.posts.map((row) => row.platform);
  const nextPlatforms = [...previousPlatforms, normalized.platform];
  const previousAuto = autoLabelFromPlatforms(previousPlatforms);
  const shouldRefreshLabel =
    !existing.title || existing.title.trim() === previousAuto || previousPlatforms.length === 0;

  return prisma.productMarketingVideo.update({
    where: { id: videoId },
    data: {
      ...(shouldRefreshLabel ? { title: autoLabelFromPlatforms(nextPlatforms) } : {}),
      posts: {
        create: {
          platform: normalized.platform,
          externalId: normalized.externalId,
          permalinkUrl: normalized.permalinkUrl,
        },
      },
    },
    include: { posts: true },
  });
}

export async function deleteMarketingVideo(id: string, productId: string) {
  const existing = await prisma.productMarketingVideo.findFirst({
    where: { id, productId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Marketing video not found.");
  }
  await prisma.productMarketingVideo.delete({ where: { id } });
}

export async function deleteMarketingVideoPost(postId: string, productId: string) {
  const existing = await prisma.productMarketingVideoPost.findFirst({
    where: { id: postId, marketingVideo: { productId } },
    include: {
      marketingVideo: {
        select: { id: true, title: true, posts: { select: { id: true, platform: true } } },
      },
    },
  });
  if (!existing) {
    throw new Error("Platform post not found.");
  }

  const remaining = existing.marketingVideo.posts.filter((row) => row.id !== postId);
  const previousAuto = autoLabelFromPlatforms(
    existing.marketingVideo.posts.map((row) => row.platform),
  );
  const shouldRefreshLabel =
    !existing.marketingVideo.title || existing.marketingVideo.title.trim() === previousAuto;

  await prisma.$transaction([
    prisma.productMarketingVideoPost.delete({ where: { id: postId } }),
    ...(shouldRefreshLabel && remaining.length > 0
      ? [
          prisma.productMarketingVideo.update({
            where: { id: existing.marketingVideo.id },
            data: { title: autoLabelFromPlatforms(remaining.map((row) => row.platform)) },
          }),
        ]
      : []),
  ]);
}

export interface MarketingFunnelPlatformRow {
  platform: SocialPlatform;
  externalId: string;
  permalinkUrl: string | null;
  lifetimeViews: number;
  rangeViews: number | null;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}

export interface MarketingFunnelVideo {
  id: string;
  title: string | null;
  utmCampaign: string | null;
  platforms: MarketingFunnelPlatformRow[];
  lifetimeViews: number;
  rangeViews: number | null;
  /** Site metrics for this video's utm_campaign when set; otherwise product-wide. */
  siteSessions: number;
  productViews: number;
  affiliateClicks: number;
}

export interface ProductMarketingFunnel {
  videos: MarketingFunnelVideo[];
  totals: {
    lifetimeViews: number;
    rangeViews: number | null;
    siteSessions: number;
    productViews: number;
    affiliateClicks: number;
  };
}

/**
 * Views gained in a date range ≈ cumulative at range end − cumulative just before range start.
 * Returns null when we lack snapshots to compute a delta (e.g. never synced).
 */
async function rangeViewDelta(
  postId: string,
  range: ResolvedDateRange,
): Promise<number | null> {
  const startDay = new Date(`${formatIsoDate(range.start)}T00:00:00.000Z`);
  const endDay = new Date(`${formatIsoDate(range.end)}T00:00:00.000Z`);

  const [beforeStart, atOrBeforeEnd] = await Promise.all([
    prisma.productMarketingVideoPostSnapshot.findFirst({
      where: { postId, day: { lt: startDay } },
      orderBy: { day: "desc" },
      select: { viewCount: true },
    }),
    prisma.productMarketingVideoPostSnapshot.findFirst({
      where: { postId, day: { lte: endDay } },
      orderBy: { day: "desc" },
      select: { viewCount: true },
    }),
  ]);

  if (!atOrBeforeEnd) return null;

  const end = Number(atOrBeforeEnd.viewCount);
  const start = beforeStart ? Number(beforeStart.viewCount) : null;

  // If we only have end-of-range data, treat range views as unknown rather than
  // claiming the entire lifetime total happened inside the window.
  if (start == null) return null;

  return Math.max(0, end - start);
}

async function siteMetricsForProduct(
  productId: string,
  range: ResolvedDateRange,
  utmCampaign: string | null,
): Promise<{ sessions: number; productViews: number; affiliateClicks: number }> {
  const campaignFilter = utmCampaign
    ? { utmCampaign }
    : {};

  const [sessions, productViews, affiliateClicks] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: {
        productId,
        createdAt: { gte: range.start, lte: range.end },
        ...campaignFilter,
        sessionId: { not: null },
      },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.analyticsEvent.count({
      where: {
        productId,
        type: "PRODUCT_VIEW",
        createdAt: { gte: range.start, lte: range.end },
        ...campaignFilter,
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        productId,
        type: "AFFILIATE_CLICK",
        createdAt: { gte: range.start, lte: range.end },
        ...campaignFilter,
      },
    }),
  ]);

  return {
    sessions: sessions.length,
    productViews,
    affiliateClicks,
  };
}

export async function getProductMarketingFunnel(
  productId: string,
  range: ResolvedDateRange,
): Promise<ProductMarketingFunnel> {
  const videos = await listMarketingVideosForProduct(productId);

  const built: MarketingFunnelVideo[] = [];

  for (const video of videos) {
    const platforms: MarketingFunnelPlatformRow[] = [];
    let lifetimeViews = 0;
    let rangeViewsSum = 0;
    let rangeViewsKnown = true;

    for (const post of video.posts) {
      const lifetime = Number(post.viewCount);
      lifetimeViews += lifetime;
      const delta = await rangeViewDelta(post.id, range);
      if (delta == null) {
        rangeViewsKnown = false;
      } else {
        rangeViewsSum += delta;
      }

      platforms.push({
        platform: post.platform,
        externalId: post.externalId,
        permalinkUrl: post.permalinkUrl,
        lifetimeViews: lifetime,
        rangeViews: delta,
        syncStatus: post.syncStatus,
        lastSyncedAt: post.lastSyncedAt,
        lastSyncError: post.lastSyncError,
      });
    }

    const site = await siteMetricsForProduct(productId, range, video.utmCampaign);

    built.push({
      id: video.id,
      title: video.title,
      utmCampaign: video.utmCampaign,
      platforms,
      lifetimeViews,
      rangeViews: rangeViewsKnown && video.posts.length > 0 ? rangeViewsSum : null,
      siteSessions: site.sessions,
      productViews: site.productViews,
      affiliateClicks: site.affiliateClicks,
    });
  }

  const hasCampaignAttribution = built.some((v) => Boolean(v.utmCampaign));
  const productWide = await siteMetricsForProduct(productId, range, null);

  const totalsLifetime = built.reduce((sum, v) => sum + v.lifetimeViews, 0);
  const allRangeKnown = built.length > 0 && built.every((v) => v.rangeViews != null);
  const totalsRange = allRangeKnown
    ? built.reduce((sum, v) => sum + (v.rangeViews ?? 0), 0)
    : null;

  // When videos declare utm_campaign, funnel site steps use those campaigns only.
  // Otherwise fall back to all product traffic in the range.
  const attributed = hasCampaignAttribution
    ? {
        sessions: built.reduce((sum, v) => sum + v.siteSessions, 0),
        productViews: built.reduce((sum, v) => sum + v.productViews, 0),
        affiliateClicks: built.reduce((sum, v) => sum + v.affiliateClicks, 0),
      }
    : productWide;

  return {
    videos: built,
    totals: {
      lifetimeViews: totalsLifetime,
      rangeViews: totalsRange,
      siteSessions: attributed.sessions,
      productViews: attributed.productViews,
      affiliateClicks: attributed.affiliateClicks,
    },
  };
}
