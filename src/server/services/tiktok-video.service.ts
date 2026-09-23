import { formatIsoDate } from "@/lib/date-range";
import { prisma } from "@/lib/prisma";
import {
  TIKTOK_VIDEO_FIELDS,
  TIKTOK_VIDEO_LIST_URL,
  TIKTOK_VIDEO_QUERY_URL,
} from "@/lib/tiktok";
import {
  TikTokAuthError,
  getValidTikTokAccessToken,
  updateTikTokUsernameHint,
} from "@/server/services/tiktok-oauth.service";
import { PlatformSyncError } from "@/server/services/social-platform-views.service";

export interface TikTokListedVideo {
  id: string;
  title: string | null;
  description: string | null;
  shareUrl: string | null;
  createTime: Date | null;
  viewCount: number;
}

export interface TikTokVideoSyncSummary {
  listed: number;
  cached: number;
  marketingPostsUpdated: number;
  failed: number;
  error?: string;
}

function usernameFromShareUrl(shareUrl: string | null | undefined): string | null {
  if (!shareUrl) return null;
  try {
    const match = new URL(shareUrl).pathname.match(/\/@([^/]+)\//);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function tiktokAuthedFetch<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const accessToken = await getValidTikTokAccessToken();
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new PlatformSyncError(
      error instanceof Error ? error.message : "Network error talking to TikTok",
      "TIKTOK",
      true,
    );
  }

  let body: T & { error?: { code?: string; message?: string } };
  try {
    body = (await response.json()) as T & { error?: { code?: string; message?: string } };
  } catch {
    throw new PlatformSyncError(`Invalid JSON from TikTok (HTTP ${response.status})`, "TIKTOK", true);
  }

  if (!response.ok || (body.error?.code && body.error.code !== "ok")) {
    const code = body.error?.code ?? `http_${response.status}`;
    const message = body.error?.message ?? `TikTok API error: ${code}`;
    if (code === "access_token_invalid" || code === "invalid_token") {
      throw new TikTokAuthError(message, code, true);
    }
    throw new PlatformSyncError(message, "TIKTOK", code === "rate_limit_exceeded" || response.status === 429);
  }

  return body;
}

/** Paginate through the authorized user's public videos. */
export async function listTikTokVideos(options?: {
  maxPages?: number;
}): Promise<TikTokListedVideo[]> {
  const maxPages = options?.maxPages ?? 25;
  const videos: TikTokListedVideo[] = [];
  let cursor: number | undefined;
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < maxPages) {
    pages += 1;
    const body: { max_count: number; cursor?: number } = { max_count: 20 };
    if (cursor !== undefined) body.cursor = cursor;

    const data = await tiktokAuthedFetch<{
      data?: {
        videos?: Array<{
          id?: string;
          title?: string;
          video_description?: string;
          share_url?: string;
          create_time?: number;
          view_count?: number;
        }>;
        cursor?: number;
        has_more?: boolean;
      };
    }>(`${TIKTOK_VIDEO_LIST_URL}?fields=${encodeURIComponent(TIKTOK_VIDEO_FIELDS)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const row of data.data?.videos ?? []) {
      if (!row.id) continue;
      videos.push({
        id: row.id,
        title: row.title ?? null,
        description: row.video_description ?? null,
        shareUrl: row.share_url ?? null,
        createTime:
          typeof row.create_time === "number" ? new Date(row.create_time * 1000) : null,
        viewCount: Math.max(0, Math.floor(Number(row.view_count ?? 0))),
      });
    }

    hasMore = Boolean(data.data?.has_more);
    cursor = data.data?.cursor;
    if (!hasMore || cursor === undefined) break;
  }

  const hint = videos.map((v) => usernameFromShareUrl(v.shareUrl)).find(Boolean) ?? null;
  await updateTikTokUsernameHint(hint);

  return videos;
}

export async function queryTikTokVideoViews(videoId: string): Promise<{
  viewCount: number;
  permalinkUrl: string | null;
}> {
  const data = await tiktokAuthedFetch<{
    data?: {
      videos?: Array<{ id?: string; view_count?: number; share_url?: string }>;
    };
  }>(`${TIKTOK_VIDEO_QUERY_URL}?fields=${encodeURIComponent("id,view_count,share_url")}`, {
    method: "POST",
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });

  const video = data.data?.videos?.find((row) => row.id === videoId) ?? data.data?.videos?.[0];
  if (!video) {
    throw new PlatformSyncError(
      "TikTok video not found for the connected account. Confirm the video ID belongs to RadarCut's TikTok.",
      "TIKTOK",
    );
  }

  const viewCount = Number(video.view_count ?? NaN);
  if (!Number.isFinite(viewCount) || viewCount < 0) {
    throw new PlatformSyncError("TikTok view_count missing", "TIKTOK");
  }

  return {
    viewCount: Math.floor(viewCount),
    permalinkUrl: video.share_url ?? null,
  };
}

/**
 * Pull TikTok video.list into the cache and update existing marketing-video
 * posts that already reference those TikTok IDs (no duplicate creates).
 */
export async function syncTikTokVideosAndMarketingPosts(): Promise<TikTokVideoSyncSummary> {
  const summary: TikTokVideoSyncSummary = {
    listed: 0,
    cached: 0,
    marketingPostsUpdated: 0,
    failed: 0,
  };

  let videos: TikTokListedVideo[];
  try {
    videos = await listTikTokVideos();
  } catch (error) {
    summary.failed = 1;
    summary.error =
      error instanceof Error ? error.message : "Failed to list TikTok videos";
    return summary;
  }

  summary.listed = videos.length;
  const today = new Date(`${formatIsoDate(new Date())}T00:00:00.000Z`);
  const now = new Date();

  for (const video of videos) {
    try {
      await prisma.tikTokCachedVideo.upsert({
        where: { id: video.id },
        create: {
          id: video.id,
          title: video.title,
          description: video.description,
          shareUrl: video.shareUrl,
          createTime: video.createTime,
          viewCount: BigInt(video.viewCount),
          lastSyncedAt: now,
        },
        update: {
          title: video.title,
          description: video.description,
          shareUrl: video.shareUrl,
          createTime: video.createTime,
          viewCount: BigInt(video.viewCount),
          lastSyncedAt: now,
        },
      });
      summary.cached += 1;

      const posts = await prisma.productMarketingVideoPost.findMany({
        where: { platform: "TIKTOK", externalId: video.id },
        select: { id: true },
      });

      for (const post of posts) {
        const viewCount = BigInt(video.viewCount);
        await prisma.$transaction([
          prisma.productMarketingVideoPost.update({
            where: { id: post.id },
            data: {
              viewCount,
              permalinkUrl: video.shareUrl ?? undefined,
              lastSyncedAt: now,
              syncStatus: "OK",
              lastSyncError: null,
            },
          }),
          prisma.productMarketingVideoPostSnapshot.upsert({
            where: { postId_day: { postId: post.id, day: today } },
            create: { postId: post.id, day: today, viewCount },
            update: { viewCount },
          }),
        ]);
        summary.marketingPostsUpdated += 1;
      }
    } catch {
      summary.failed += 1;
    }
  }

  await prisma.tikTokOAuthConnection.updateMany({
    where: { key: "default", status: "CONNECTED" },
    data: { lastSyncedAt: now, lastError: null },
  });

  return summary;
}

export async function listCachedTikTokVideos(limit = 50) {
  return prisma.tikTokCachedVideo.findMany({
    orderBy: [{ createTime: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
}
