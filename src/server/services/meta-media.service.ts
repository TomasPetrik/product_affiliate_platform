import { formatIsoDate } from "@/lib/date-range";
import { metaGraphUrl } from "@/lib/meta";
import { prisma } from "@/lib/prisma";
import {
  MetaAuthError,
  getMetaConnectionInternal,
  getValidMetaPageAccessToken,
} from "@/server/services/meta-oauth.service";
import { PlatformSyncError } from "@/server/services/social-platform-views.service";

export interface MetaMediaSyncSummary {
  instagramListed: number;
  facebookListed: number;
  cached: number;
  marketingPostsUpdated: number;
  failed: number;
  error?: string;
}

async function graphGetWithPageToken<T>(
  path: string,
  query: Record<string, string>,
): Promise<T> {
  const pageToken = await getValidMetaPageAccessToken();
  const url = metaGraphUrl(path, { ...query, access_token: pageToken });

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
  } catch (error) {
    throw new PlatformSyncError(
      error instanceof Error ? error.message : "Network error talking to Meta",
      "INSTAGRAM",
      true,
    );
  }

  const body = (await response.json()) as T & {
    error?: { message?: string; code?: number };
  };

  if (!response.ok || body.error) {
    const message = body.error?.message ?? `Meta Graph HTTP ${response.status}`;
    const code = String(body.error?.code ?? response.status);
    if (code === "190") {
      throw new MetaAuthError(message, code, true);
    }
    throw new PlatformSyncError(message, "INSTAGRAM", response.status === 429 || response.status >= 500);
  }

  return body;
}

async function fetchInstagramMediaInsightsViews(mediaId: string): Promise<number | null> {
  try {
    const data = await graphGetWithPageToken<{
      data?: Array<{ name?: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }>;
    }>(`/${mediaId}/insights`, { metric: "views" });

    const viewsMetric = data.data?.find((row) => row.name === "views");
    const value = Number(viewsMetric?.total_value?.value ?? viewsMetric?.values?.[0]?.value ?? NaN);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  } catch {
    return null;
  }
}

async function updateMarketingPosts(
  platform: "INSTAGRAM" | "FACEBOOK",
  externalId: string,
  viewCount: number,
  permalinkUrl: string | null,
  today: Date,
  now: Date,
): Promise<number> {
  const posts = await prisma.productMarketingVideoPost.findMany({
    where: { platform, externalId },
    select: { id: true },
  });

  let updated = 0;
  for (const post of posts) {
    const count = BigInt(viewCount);
    await prisma.$transaction([
      prisma.productMarketingVideoPost.update({
        where: { id: post.id },
        data: {
          viewCount: count,
          permalinkUrl: permalinkUrl ?? undefined,
          lastSyncedAt: now,
          syncStatus: "OK",
          lastSyncError: null,
        },
      }),
      prisma.productMarketingVideoPostSnapshot.upsert({
        where: { postId_day: { postId: post.id, day: today } },
        create: { postId: post.id, day: today, viewCount: count },
        update: { viewCount: count },
      }),
    ]);
    updated += 1;
  }
  return updated;
}

/**
 * List Instagram media + Facebook Page videos, cache them, and update matching
 * marketing-video posts (no duplicate creates).
 */
export async function syncMetaMediaAndMarketingPosts(): Promise<MetaMediaSyncSummary> {
  const summary: MetaMediaSyncSummary = {
    instagramListed: 0,
    facebookListed: 0,
    cached: 0,
    marketingPostsUpdated: 0,
    failed: 0,
  };

  const connection = await getMetaConnectionInternal();
  if (!connection || connection.status !== "CONNECTED") {
    summary.error = "Meta is not connected.";
    summary.failed = 1;
    return summary;
  }

  const today = new Date(`${formatIsoDate(new Date())}T00:00:00.000Z`);
  const now = new Date();

  try {
    if (connection.instagramBusinessAccountId) {
      let nextUrl: string | null = metaGraphUrl(
        `/${connection.instagramBusinessAccountId}/media`,
        {
          fields: "id,caption,media_type,media_product_type,permalink,timestamp",
          limit: "50",
          access_token: await getValidMetaPageAccessToken(),
        },
      );

      let pages = 0;
      while (nextUrl && pages < 10) {
        pages += 1;
        const response = await fetch(nextUrl, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
        const data = (await response.json()) as {
          data?: Array<{
            id?: string;
            caption?: string;
            media_type?: string;
            media_product_type?: string;
            permalink?: string;
            timestamp?: string;
          }>;
          paging?: { next?: string };
          error?: { message?: string };
        };

        if (!response.ok || data.error) {
          throw new PlatformSyncError(
            data.error?.message ?? `Instagram media list failed (HTTP ${response.status})`,
            "INSTAGRAM",
          );
        }

        for (const item of data.data ?? []) {
          if (!item.id) continue;
          summary.instagramListed += 1;
          const views = (await fetchInstagramMediaInsightsViews(item.id)) ?? 0;
          const title = item.caption?.slice(0, 200) ?? item.media_product_type ?? item.media_type ?? null;

          await prisma.metaCachedMedia.upsert({
            where: {
              platform_externalId: { platform: "INSTAGRAM", externalId: item.id },
            },
            create: {
              platform: "INSTAGRAM",
              externalId: item.id,
              title,
              permalinkUrl: item.permalink ?? null,
              mediaType: item.media_product_type ?? item.media_type ?? null,
              createTime: item.timestamp ? new Date(item.timestamp) : null,
              viewCount: BigInt(views),
              lastSyncedAt: now,
            },
            update: {
              title,
              permalinkUrl: item.permalink ?? null,
              mediaType: item.media_product_type ?? item.media_type ?? null,
              createTime: item.timestamp ? new Date(item.timestamp) : null,
              viewCount: BigInt(views),
              lastSyncedAt: now,
            },
          });
          summary.cached += 1;
          summary.marketingPostsUpdated += await updateMarketingPosts(
            "INSTAGRAM",
            item.id,
            views,
            item.permalink ?? null,
            today,
            now,
          );
        }

        nextUrl = data.paging?.next ?? null;
      }
    }

    {
      let nextUrl: string | null = metaGraphUrl(`/${connection.pageId}/videos`, {
        fields: "id,title,description,views,permalink_url,created_time",
        limit: "50",
        access_token: await getValidMetaPageAccessToken(),
      });

      let pages = 0;
      while (nextUrl && pages < 10) {
        pages += 1;
        const response = await fetch(nextUrl, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
        const data = (await response.json()) as {
          data?: Array<{
            id?: string;
            title?: string;
            description?: string;
            views?: number | string;
            permalink_url?: string;
            created_time?: string;
          }>;
          paging?: { next?: string };
          error?: { message?: string };
        };

        if (!response.ok || data.error) {
          throw new PlatformSyncError(
            data.error?.message ?? `Facebook videos list failed (HTTP ${response.status})`,
            "FACEBOOK",
          );
        }

        for (const item of data.data ?? []) {
          if (!item.id) continue;
          summary.facebookListed += 1;
          const views = Math.max(0, Math.floor(Number(item.views ?? 0)));
          const title = item.title ?? item.description?.slice(0, 200) ?? null;
          const permalink = item.permalink_url
            ? item.permalink_url.startsWith("http")
              ? item.permalink_url
              : `https://www.facebook.com${item.permalink_url}`
            : null;

          await prisma.metaCachedMedia.upsert({
            where: {
              platform_externalId: { platform: "FACEBOOK", externalId: item.id },
            },
            create: {
              platform: "FACEBOOK",
              externalId: item.id,
              title,
              permalinkUrl: permalink,
              mediaType: "VIDEO",
              createTime: item.created_time ? new Date(item.created_time) : null,
              viewCount: BigInt(views),
              lastSyncedAt: now,
            },
            update: {
              title,
              permalinkUrl: permalink,
              mediaType: "VIDEO",
              createTime: item.created_time ? new Date(item.created_time) : null,
              viewCount: BigInt(views),
              lastSyncedAt: now,
            },
          });
          summary.cached += 1;
          summary.marketingPostsUpdated += await updateMarketingPosts(
            "FACEBOOK",
            item.id,
            views,
            permalink,
            today,
            now,
          );
        }

        nextUrl = data.paging?.next ?? null;
      }
    }

    await prisma.metaOAuthConnection.updateMany({
      where: { key: "default", status: "CONNECTED" },
      data: { lastSyncedAt: now, lastError: null },
    });
  } catch (error) {
    summary.failed += 1;
    summary.error =
      error instanceof Error ? error.message : "Failed to sync Meta media";
  }

  return summary;
}

export async function listCachedMetaMedia(limit = 50) {
  return prisma.metaCachedMedia.findMany({
    orderBy: [{ createTime: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
}
