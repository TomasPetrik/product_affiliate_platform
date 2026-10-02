import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminFlash } from "@/components/admin/admin-flash";
import { CommentAutoReplyPanel } from "@/components/admin/comment-auto-reply-panel";
import { MarketingVideosPanel } from "@/components/admin/marketing-videos-panel";
import { ProductForm, type ProductFormLinkValues } from "@/components/admin/product-form";
import { ReplaceHeroImagePanel } from "@/components/admin/replace-hero-image-panel";
import { RetailerOffersPanel } from "@/components/admin/retailer-offers-panel";
import { adminNoticeMessage } from "@/lib/admin-notice";
import { affiliateGoHref } from "@/lib/affiliate-go";
import { env } from "@/lib/env";
import { listCommentAutoReplyRulesForProduct } from "@/server/services/comment-auto-reply.service";
import { listMarketingVideosForProduct } from "@/server/services/marketing-video.service";
import {
  getProductByIdAdmin,
  listCategoriesForSelect,
  listMarketplaces,
} from "@/server/services/product.service";
import { listRetailerOffersForProduct } from "@/server/services/retailer-offer.service";

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
  const [product, categories, marketplaces, offers, marketingVideos, autoReplyRules] =
    await Promise.all([
      getProductByIdAdmin(id),
      listCategoriesForSelect(),
      listMarketplaces(),
      listRetailerOffersForProduct(id),
      listMarketingVideosForProduct(id),
      listCommentAutoReplyRulesForProduct(id),
    ]);

  if (!product) {
    notFound();
  }

  const links: Record<string, ProductFormLinkValues> = {};
  let primaryMarketplaceId = "";
  let primaryMarketplaceCode: string | undefined;
  for (const link of product.affiliateLinks) {
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
    if (link.isPrimary) {
      primaryMarketplaceId = link.marketplaceId;
      primaryMarketplaceCode = link.marketplace?.code;
    }
  }

  const noticeKey = typeof query.notice === "string" ? query.notice : undefined;
  const currentHeroUrl =
    product.images.find((image) => image.isPrimary)?.url ??
    product.images[0]?.url ??
    product.ogImageUrl ??
    null;
  const siteBase = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const defaultReplyUrl = `${siteBase}${affiliateGoHref(product.slug, primaryMarketplaceCode)}`;

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

      {/* Social / comment automation first — most frequent setup while promoting. */}
      <MarketingVideosPanel productId={product.id} videos={marketingVideosView} />
      <CommentAutoReplyPanel
        productId={product.id}
        defaultReplyUrl={defaultReplyUrl}
        rules={autoReplyRulesView}
      />

      <ReplaceHeroImagePanel
        productId={product.id}
        title={product.title}
        brand={product.brand}
        shortDescription={product.shortDescription}
        currentHeroUrl={currentHeroUrl}
        highlight={noticeKey === "imported"}
      />
      <ProductForm
        categories={categories}
        marketplaces={marketplaces}
        amazonAssociatesTag={env.AMAZON_ASSOCIATES_TAG ?? null}
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
          primaryMarketplaceId,
        }}
      />
      <RetailerOffersPanel productId={product.id} offers={offers} />
    </div>
  );
}
