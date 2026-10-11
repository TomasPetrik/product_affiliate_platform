import type { SocialPlatform } from "@/generated/prisma/enums";
import { SOCIAL_PLATFORMS } from "@/lib/social-external-id";

/** Amazon hop links are always one Associates store tag per social platform. */
export const AMAZON_HOP_PLATFORMS: SocialPlatform[] = [...SOCIAL_PLATFORMS];

export type AmazonAssociatesTagsByPlatform = Record<SocialPlatform, string | null>;

export function parseSocialPlatformParam(raw: string | null | undefined): SocialPlatform | null {
  const normalized = raw?.trim().toUpperCase();
  if (!normalized) return null;
  return (AMAZON_HOP_PLATFORMS as string[]).includes(normalized)
    ? (normalized as SocialPlatform)
    : null;
}

/** Short query value for `/go/...?p=instagram`. */
export function socialPlatformQueryValue(platform: SocialPlatform): string {
  return platform.toLowerCase();
}

/** Resolve Associates `tag=` for a social platform (platform env first, then legacy fallback). */
export function resolveAmazonAssociatesTagForPlatform(
  platform: SocialPlatform,
  tags: AmazonAssociatesTagsByPlatform,
  fallbackTag?: string | null,
): string | null {
  const platformTag = tags[platform]?.trim() || null;
  if (platformTag) return platformTag;
  const fallback = fallbackTag?.trim() || null;
  return fallback || null;
}

export function missingAmazonAssociatesPlatformTags(
  tags: AmazonAssociatesTagsByPlatform,
  fallbackTag?: string | null,
): SocialPlatform[] {
  return AMAZON_HOP_PLATFORMS.filter(
    (platform) => !resolveAmazonAssociatesTagForPlatform(platform, tags, fallbackTag),
  );
}
