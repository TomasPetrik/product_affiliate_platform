import type { SocialPlatform } from "@/generated/prisma/enums";

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const META_MEDIA_ID = /^\d{5,}$/;

/**
 * Accept a bare platform ID or a common share URL and return the external ID
 * used by each network's insights / statistics API.
 */
export function parseSocialExternalId(
  platform: SocialPlatform,
  raw: string,
): { ok: true; externalId: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Video / media ID is required." };
  }

  switch (platform) {
    case "YOUTUBE":
      return parseYouTubeId(trimmed);
    case "TIKTOK":
      return parseTikTokId(trimmed);
    case "INSTAGRAM":
      return parseMetaMediaId(trimmed, "Instagram");
    case "FACEBOOK":
      return parseMetaMediaId(trimmed, "Facebook");
    default:
      return { ok: false, error: "Unknown platform." };
  }
}

function parseYouTubeId(raw: string): { ok: true; externalId: string } | { ok: false; error: string } {
  if (YOUTUBE_ID.test(raw)) {
    return { ok: true, externalId: raw };
  }

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      if (YOUTUBE_ID.test(id)) return { ok: true, externalId: id };
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && YOUTUBE_ID.test(v)) return { ok: true, externalId: v };

      const parts = url.pathname.split("/").filter(Boolean);
      const shortIdx = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live");
      if (shortIdx >= 0) {
        const id = parts[shortIdx + 1] ?? "";
        if (YOUTUBE_ID.test(id)) return { ok: true, externalId: id };
      }
    }
  } catch {
    // fall through
  }

  return { ok: false, error: "Could not parse a YouTube video ID. Paste the 11-character ID or a youtube.com / youtu.be URL." };
}

function parseTikTokId(raw: string): { ok: true; externalId: string } | { ok: false; error: string } {
  if (/^\d{5,}$/.test(raw)) {
    return { ok: true, externalId: raw };
  }

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match?.[1]) {
      return { ok: true, externalId: match[1] };
    }
  } catch {
    // fall through
  }

  return {
    ok: false,
    error: "Could not parse a TikTok video ID. Paste the numeric ID or a tiktok.com/.../video/{id} URL.",
  };
}

function parseMetaMediaId(
  raw: string,
  label: string,
): { ok: true; externalId: string } | { ok: false; error: string } {
  // Graph media IDs are numeric. Share URLs use shortcodes — resolved server-side via Meta cache/API.
  if (META_MEDIA_ID.test(raw)) {
    return { ok: true, externalId: raw };
  }

  // Underscore form used for some IG media: {ig-user-id}_{media-id}
  if (/^\d+_\d+$/.test(raw)) {
    return { ok: true, externalId: raw };
  }

  if (label === "Instagram" && extractInstagramShortcode(raw)) {
    return {
      ok: false,
      error: "INSTAGRAM_URL_NEEDS_RESOLVE",
    };
  }

  if (label === "Facebook" && looksLikeHttpUrl(raw)) {
    return {
      ok: false,
      error: "FACEBOOK_URL_NEEDS_RESOLVE",
    };
  }

  return {
    ok: false,
    error: `${label} needs the Graph media/video ID (digits), not the share URL. Sync Meta Media in Settings and paste the ID from the cached list, or paste an Instagram/Facebook URL after Sync so RadarCut can resolve it.`,
  };
}

function looksLikeHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw) || raw.includes("facebook.com") || raw.includes("fb.watch");
}

/** Extract Instagram shortcode from /reel/{code}/, /p/{code}/, /tv/{code}/ URLs. */
export function extractInstagramShortcode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "instagram.com" && !host.endsWith(".instagram.com")) {
      return null;
    }
    const match = url.pathname.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "TIKTOK"];

/** e.g. ["YOUTUBE"] → "YouTube"; ["INSTAGRAM","YOUTUBE"] → "Instagram · YouTube" */
export function autoLabelFromPlatforms(platforms: SocialPlatform[]): string {
  return SOCIAL_PLATFORMS.filter((platform) => platforms.includes(platform))
    .map((platform) => SOCIAL_PLATFORM_LABELS[platform])
    .join(" · ");
}
