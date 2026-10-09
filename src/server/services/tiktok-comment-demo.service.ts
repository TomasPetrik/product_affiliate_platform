import { prisma } from "@/lib/prisma";
import { affiliateGoHref, pickAffiliateHopMarketplaceCode } from "@/lib/affiliate-go";
import { env } from "@/lib/env";
import { productShortPath } from "@/lib/product-short-url";
import type { TikTokCommentDemoProduct } from "@/lib/tiktok-comment-demo";
import { getSiteSettings } from "@/server/services/site-settings.service";

export type { TikTokCommentDemoProduct } from "@/lib/tiktok-comment-demo";
export {
  simulateTikTokKeywordMatch,
  type TikTokCommentDemoSimulation,
} from "@/lib/tiktok-comment-demo";

/**
 * Products suitable for TikTok Accounts API review demos:
 * TikTok keyword rules, or any product with marketing TikTok posts.
 */
export async function listTikTokCommentDemoProducts(limit = 40): Promise<TikTokCommentDemoProduct[]> {
  const siteBase = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const siteSettings = await getSiteSettings();

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { commentAutoReplyRules: { some: { enableTikTok: true } } },
        {
          marketingVideos: {
            some: { posts: { some: { platform: "TIKTOK" } } },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      publicId: true,
      affiliateLinks: {
        where: { isActive: true },
        select: {
          isPrimary: true,
          affiliateUrl: true,
          lastKnownPrice: true,
          marketplace: { select: { code: true } },
        },
      },
      commentAutoReplyRules: {
        where: { enableTikTok: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          keyword: true,
          publicReplyMessage: true,
          dmReplyMessage: true,
          replyUrl: true,
          enablePublicReply: true,
          enablePrivateDm: true,
          isActive: true,
        },
      },
      marketingVideos: {
        select: {
          posts: {
            where: { platform: "TIKTOK" },
            select: { externalId: true, permalinkUrl: true },
            take: 3,
          },
        },
      },
    },
  });

  return products.map((product) => {
    const marketplaceCode = pickAffiliateHopMarketplaceCode(
      product.affiliateLinks.map((link) => ({
        marketplace: link.marketplace.code,
        isPrimary: link.isPrimary,
        isActive: true,
        affiliateUrl: link.affiliateUrl,
        price: link.lastKnownPrice != null ? Number(link.lastKnownPrice) : null,
      })),
      siteSettings,
    );
    const hopPath = affiliateGoHref(product.slug, marketplaceCode);
    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      publicId: product.publicId,
      productUrl: `${siteBase}${productShortPath(product.publicId)}`,
      hopUrl: `${siteBase}${hopPath}`,
      tiktokAccountHint: "RadarCut Finds",
      rules: product.commentAutoReplyRules,
      linkedTikTokPosts: product.marketingVideos.flatMap((video) => video.posts),
    };
  });
}
