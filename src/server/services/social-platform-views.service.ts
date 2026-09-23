import { env } from "@/lib/env";
import type { SocialPlatform } from "@/generated/prisma/enums";
import {
  TikTokAuthError,
  getValidTikTokAccessToken,
  isTikTokSyncConfigured,
} from "@/server/services/tiktok-oauth.service";

export interface PlatformViewResult {
  viewCount: number;
  permalinkUrl?: string | null;
}

export class PlatformSyncError extends Error {
  constructor(
    message: string,
    readonly platform: SocialPlatform,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "PlatformSyncError";
  }
}

function metaConfigured(): boolean {
  return Boolean(env.META_ACCESS_TOKEN);
}

function youtubeConfigured(): boolean {
  return Boolean(env.YOUTUBE_API_KEY);
}

export async function isPlatformSyncConfigured(platform: SocialPlatform): Promise<boolean> {
  switch (platform) {
    case "INSTAGRAM":
    case "FACEBOOK":
      return metaConfigured();
    case "YOUTUBE":
      return youtubeConfigured();
    case "TIKTOK":
      return isTikTokSyncConfigured();
  }
}

export async function fetchPlatformViewCount(
  platform: SocialPlatform,
  externalId: string,
): Promise<PlatformViewResult> {
  switch (platform) {
    case "INSTAGRAM":
      return fetchInstagramViews(externalId);
    case "FACEBOOK":
      return fetchFacebookViews(externalId);
    case "YOUTUBE":
      return fetchYouTubeViews(externalId);
    case "TIKTOK":
      return fetchTikTokViews(externalId);
  }
}

async function fetchInstagramViews(mediaId: string): Promise<PlatformViewResult> {
  if (!env.META_ACCESS_TOKEN) {
    throw new PlatformSyncError("META_ACCESS_TOKEN is not configured", "INSTAGRAM");
  }

  const version = env.META_GRAPH_API_VERSION;
  const token = encodeURIComponent(env.META_ACCESS_TOKEN);
  const insightsUrl = `https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}/insights?metric=views&access_token=${token}`;
  const insights = await fetchJson<{
    data?: Array<{ name?: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }>;
    error?: { message?: string };
  }>(insightsUrl, "INSTAGRAM");

  const viewsMetric = insights.data?.find((row) => row.name === "views");
  const fromValues = viewsMetric?.values?.[0]?.value;
  const fromTotal = viewsMetric?.total_value?.value;
  const viewCount = Number(fromTotal ?? fromValues ?? NaN);

  if (!Number.isFinite(viewCount) || viewCount < 0) {
    throw new PlatformSyncError(
      insights.error?.message ??
        "Instagram insights returned no views metric. Confirm the media ID belongs to your IG Business account and the token has instagram_manage_insights.",
      "INSTAGRAM",
    );
  }

  const permalinkUrl = await fetchMetaPermalink(mediaId, "INSTAGRAM");
  return { viewCount: Math.floor(viewCount), permalinkUrl };
}

async function fetchFacebookViews(videoId: string): Promise<PlatformViewResult> {
  if (!env.META_ACCESS_TOKEN) {
    throw new PlatformSyncError("META_ACCESS_TOKEN is not configured", "FACEBOOK");
  }

  const version = env.META_GRAPH_API_VERSION;
  const token = encodeURIComponent(env.META_ACCESS_TOKEN);
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(videoId)}?fields=views,permalink_url&access_token=${token}`;
  const data = await fetchJson<{
    views?: number | string;
    permalink_url?: string;
    error?: { message?: string };
  }>(url, "FACEBOOK");

  const viewCount = Number(data.views);
  if (!Number.isFinite(viewCount) || viewCount < 0) {
    throw new PlatformSyncError(
      data.error?.message ??
        "Facebook returned no views field. Confirm this is a Video node ID and the Page token can read it.",
      "FACEBOOK",
    );
  }

  return {
    viewCount: Math.floor(viewCount),
    permalinkUrl: data.permalink_url ?? null,
  };
}

async function fetchMetaPermalink(
  mediaId: string,
  platform: "INSTAGRAM" | "FACEBOOK",
): Promise<string | null> {
  if (!env.META_ACCESS_TOKEN) return null;
  try {
    const version = env.META_GRAPH_API_VERSION;
    const token = encodeURIComponent(env.META_ACCESS_TOKEN);
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}?fields=permalink&access_token=${token}`;
    const data = await fetchJson<{ permalink?: string }>(url, platform);
    return data.permalink ?? null;
  } catch {
    return null;
  }
}

async function fetchYouTubeViews(videoId: string): Promise<PlatformViewResult> {
  if (!env.YOUTUBE_API_KEY) {
    throw new PlatformSyncError("YOUTUBE_API_KEY is not configured", "YOUTUBE");
  }

  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=statistics` +
    `&id=${encodeURIComponent(videoId)}` +
    `&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`;

  const data = await fetchJson<{
    items?: Array<{ statistics?: { viewCount?: string } }>;
    error?: { message?: string };
  }>(url, "YOUTUBE");

  const item = data.items?.[0];
  if (!item) {
    throw new PlatformSyncError(
      data.error?.message ?? "YouTube video not found. Check the video ID and that the video is public.",
      "YOUTUBE",
    );
  }

  const viewCount = Number(item.statistics?.viewCount ?? NaN);
  if (!Number.isFinite(viewCount) || viewCount < 0) {
    throw new PlatformSyncError("YouTube statistics.viewCount missing", "YOUTUBE");
  }

  return {
    viewCount: Math.floor(viewCount),
    permalinkUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function fetchTikTokViews(videoId: string): Promise<PlatformViewResult> {
  let accessToken: string;
  try {
    accessToken = await getValidTikTokAccessToken();
  } catch (error) {
    if (error instanceof TikTokAuthError) {
      throw new PlatformSyncError(
        error.needsReauth
          ? "TikTok requires reconnection. Open Admin → Settings → Reconnect TikTok."
          : error.message,
        "TIKTOK",
      );
    }
    throw error;
  }

  const url = "https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,share_url";
  const data = await fetchJson<{
    data?: { videos?: Array<{ id?: string; view_count?: number; share_url?: string }> };
    error?: { code?: string; message?: string };
  }>(url, "TIKTOK", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });

  if (data.error?.code && data.error.code !== "ok") {
    throw new PlatformSyncError(
      data.error.message ?? `TikTok API error: ${data.error.code}`,
      "TIKTOK",
      data.error.code === "rate_limit_exceeded",
    );
  }

  const video = data.data?.videos?.find((row) => row.id === videoId) ?? data.data?.videos?.[0];
  if (!video) {
    throw new PlatformSyncError(
      "TikTok video not found for this access token. Confirm video.list scope and that the video belongs to the authorized account.",
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

async function fetchJson<T>(
  url: string,
  platform: SocialPlatform,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new PlatformSyncError(
      error instanceof Error ? error.message : "Network error talking to platform API",
      platform,
      true,
    );
  }

  let body: T & { error?: { message?: string; code?: number | string } };
  try {
    body = (await response.json()) as T & { error?: { message?: string; code?: number | string } };
  } catch {
    throw new PlatformSyncError(`Invalid JSON from ${platform} (HTTP ${response.status})`, platform, true);
  }

  if (!response.ok) {
    const message =
      (typeof body.error === "object" && body.error?.message) ||
      `HTTP ${response.status} from ${platform}`;
    throw new PlatformSyncError(message, platform, response.status === 429 || response.status >= 500);
  }

  return body;
}
