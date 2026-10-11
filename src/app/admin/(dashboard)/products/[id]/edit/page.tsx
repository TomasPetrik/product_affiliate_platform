import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminFlash } from "@/components/admin/admin-flash";
import { EditProductPanels } from "@/components/admin/edit-product-panels";
import { RetailerOffersPanel } from "@/components/admin/retailer-offers-panel";
import {
  type ProductFormAmazonPlatformLinks,
  type ProductFormLinkValues,
} from "@/components/admin/product-form";
import { adminNoticeMessage } from "@/lib/admin-notice";
import { affiliateGoHref, pickAffiliateHopMarketplaceCode } from "@/lib/affiliate-go";
import { AMAZON_HOP_PLATFORMS } from "@/lib/amazon-platform-tags";
import { env } from "@/lib/env";
import type { SocialPlatform } from "@/generated/prisma/enums";
import { listCommentAutoReplyRulesForProduct } from "@/server/services/comment-auto-reply.service";
import { listMarketingVideosForProduct } from "@/server/services/marketing-video.service";
import {
  getProductByIdAdmin,
  listCategoriesForSelect,
  listMarketplaces,
} from "@/server/services/product.service";
import { listRetailerOffersForProduct } from "@/server/services/retailer-offer.service";
import { getSiteSettings } from "@/server/services/site-settings.service";

export const metadata: Metadata = {
  title: "Edit product",
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const [product, categories, marketplaces, offers, marketingVideos, autoReplyRules, siteSettings] =
    await Promise.all([
      getProductByIdAdmin(id),
      listCategoriesForSelect(),
      listMarketplaces(),
      listRetailerOffersForProduct(id),
      listMarketingVideosForProduct(id),
      listCommentAutoReplyRulesForProduct(id),
      getSiteSettings(),
    ]);

  if (!product) {
    notFound();
  }

  const links: Record<string, ProductFormLinkValues> = {};
  const amazonPlatformLinks: Record<string, ProductFormAmazonPlatformLinks> = {};
  let primaryMarketplaceId = "";
  for (const link of product.affiliateLinks) {
    const existing = links[link.marketplaceId];
    if (!existing || link.isPrimary || link.marketplace.code !== "AMAZON") {
      links[link.marketplaceId] = {
        affiliateUrl: link.affiliateUrl,
        rawProductUrl: link.rawProductUrl,
        externalProductId: link.externalProductId,
        trackingTag: link.trackingTag ?? "",
        lastKnownPrice: link.lastKnownPrice != null ? String(link.lastKnownPrice) : "",
        lastKnownOriginalPrice:
          link.lastKnownOriginalPrice != null ? String(link.lastKnownOriginalPrice) : "",
        lastKnownPriceCurrency: link.lastKnownPriceCurrency ?? "",
        lastKnownAvailability: link.lastKnownAvailability ?? "",
        isActive: link.isActive,
      };
    }
    if (link.marketplace.code === "AMAZON" && link.socialPlatform) {
      if (!amazonPlatformLinks[link.marketplaceId]) {
        amazonPlatformLinks[link.marketplaceId] = {
          INSTAGRAM: "",
          FACEBOOK: "",
          YOUTUBE: "",
          TIKTOK: "",
        };
      }
      amazonPlatformLinks[link.marketplaceId]![link.socialPlatform as SocialPlatform] =
        link.affiliateUrl;
    } else if (link.marketplace.code === "AMAZON" && !link.socialPlatform) {
      // Legacy single Amazon offer — prefill all platform slots so save creates the 4 hops.
      if (!amazonPlatformLinks[link.marketplaceId]) {
        amazonPlatformLinks[link.marketplaceId] = Object.fromEntries(
          AMAZON_HOP_PLATFORMS.map((platform) => [platform, link.affiliateUrl]),
        ) as ProductFormAmazonPlatformLinks;
      }
    }
    if (link.isPrimary) {
      primaryMarketplaceId = link.marketplaceId;
    }
  }

  const noticeKey = typeof query.notice === "string" ? query.notice : undefined;
  const currentHeroUrl =
    product.images.find((image) => image.isPrimary)?.url ??
    product.images[0]?.url ??
    product.ogImageUrl ??
    null;
  const siteBase = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const hopMarketplaceCode = pickAffiliateHopMarketplaceCode(
    product.affiliateLinks.map((link) => ({
      marketplace: link.marketplace.code,
      isPrimary: link.isPrimary,
      isActive: link.isActive,
      affiliateUrl: link.affiliateUrl,
      price: link.lastKnownPrice != null ? Number(link.lastKnownPrice) : null,
    })),
    siteSettings,
  );
  const defaultReplyUrl = `${siteBase}${affiliateGoHref(product.slug, hopMarketplaceCode)}`;

  const platformHopUrls = Object.fromEntries(
    AMAZON_HOP_PLATFORMS.map((platform) => {
      const link = product.affiliateLinks.find(
        (row) => row.marketplace.code === "AMAZON" && row.socialPlatform === platform && row.isActive,
      );
      if (!link) return [platform, ""];
      return [
        platform,
        `${siteBase}${affiliateGoHref(product.slug, "AMAZON", link.id, platform)}`,
      ];
    }),
  ) as Partial<Record<SocialPlatform, string>>;

  const marketingVideosView = marketingVideos.map((video) => ({
    id: video.id,
    title: video.title,
    utmCampaign: video.utmCampaign,
    posts: video.posts.map((post) => ({
      id: post.id,
      platform: post.platform,
      externalId: post.externalId,
      permalinkUrl: post.permalinkUrl,
      viewCount: Number(post.viewCount),
      syncStatus: post.syncStatus,
      lastSyncedAt: post.lastSyncedAt,
      lastSyncError: post.lastSyncError,
    })),
  }));

  const autoReplyRulesView = autoReplyRules.map((rule) => ({
    id: rule.id,
    keyword: rule.keyword,
    publicReplyMessage: rule.publicReplyMessage,
    dmReplyMessage: rule.dmReplyMessage,
    replyUrl: rule.replyUrl,
    enablePublicReply: rule.enablePublicReply,
    enablePrivateDm: rule.enablePrivateDm,
    enableInstagram: rule.enableInstagram,
    enableFacebook: rule.enableFacebook,
    enableTikTok: rule.enableTikTok,
    isActive: rule.isActive,
  }));

  return (
    <div className="flex flex-col gap-6">
      <AdminFlash
        notice={adminNoticeMessage(noticeKey)}
        error={typeof query.error === "string" ? query.error : undefined}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
        <p className="mt-1 text-sm text-muted-foreground">{product.title}</p>
      </div>

      <EditProductPanels
        productId={product.id}
        title={product.title}
        brand={product.brand}
        shortDescription={product.shortDescription}
        currentHeroUrl={currentHeroUrl}
        highlightHero={noticeKey === "imported"}
        marketingVideos={marketingVideosView}
        platformHopUrls={platformHopUrls}
        defaultReplyUrl={defaultReplyUrl}
        autoReplyRules={autoReplyRulesView}
        categories={categories}
        marketplaces={marketplaces}
        amazonAssociatesTag={env.AMAZON_ASSOCIATES_TAG ?? null}
        amazonAssociatesTags={{
          INSTAGRAM: env.AMAZON_ASSOCIATES_TAG_INSTAGRAM ?? null,
          FACEBOOK: env.AMAZON_ASSOCIATES_TAG_FACEBOOK ?? null,
          YOUTUBE: env.AMAZON_ASSOCIATES_TAG_YOUTUBE ?? null,
          TIKTOK: env.AMAZON_ASSOCIATES_TAG_TIKTOK ?? null,
        }}
        defaultValues={{
          id: product.id,
          publicId: product.publicId,
          title: product.title,
          slug: product.slug,
          brand: product.brand ?? "",
          modelNumber: product.modelNumber ?? "",
          gtin: product.gtin ?? "",
          mpn: product.mpn ?? "",
          categoryId: product.categoryId ?? "",
          shortDescription: product.shortDescription ?? "",
          longDescription: product.longDescription ?? "",
          status: product.status,
          isFeatured: product.isFeatured,
          isTrending: product.isTrending,
          currency: product.currency,
          displayPrice: product.displayPrice ? String(product.displayPrice) : "",
          originalPrice: product.originalPrice ? String(product.originalPrice) : "",
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          ogImageUrl: product.ogImageUrl ?? "",
          images: product.images.map((image) => ({
            url: image.url,
            altText: image.altText ?? "",
            isPrimary: image.isPrimary,
          })),
          links,
          amazonPlatformLinks,
          primaryMarketplaceId,
        }}
      />
      <RetailerOffersPanel productId={product.id} offers={offers} />
    </div>
  );
}
