"use client";

import { CommentAutoReplyPanel } from "@/components/admin/comment-auto-reply-panel";
import {
  MarketingVideosPanel,
  type MarketingVideoView,
} from "@/components/admin/marketing-videos-panel";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { ReplaceHeroImagePanel } from "@/components/admin/replace-hero-image-panel";
import type { AmazonAssociatesTagsByPlatform } from "@/lib/amazon-platform-tags";
import type { SocialPlatform } from "@/generated/prisma/enums";

interface EditProductPanelsProps {
  productId: string;
  title: string;
  brand: string | null;
  shortDescription: string | null;
  currentHeroUrl: string | null;
  highlightHero?: boolean;
  marketingVideos: MarketingVideoView[];
  platformHopUrls: Partial<Record<SocialPlatform, string>>;
  defaultReplyUrl: string;
  autoReplyRules: Array<{
    id: string;
    keyword: string;
    publicReplyMessage: string;
    dmReplyMessage: string;
    replyUrl: string;
    enablePublicReply: boolean;
    enablePrivateDm: boolean;
    enableInstagram: boolean;
    enableFacebook: boolean;
    enableTikTok: boolean;
    isActive: boolean;
  }>;
  categories: Array<{ id: string; name: string; parent: { name: string } | null }>;
  marketplaces: Array<{ id: string; code: string; name: string }>;
  amazonAssociatesTag: string | null;
  amazonAssociatesTags: AmazonAssociatesTagsByPlatform;
  defaultValues: ProductFormValues;
}

export function EditProductPanels({
  productId,
  title,
  brand,
  shortDescription,
  currentHeroUrl,
  highlightHero = false,
  marketingVideos,
  platformHopUrls,
  defaultReplyUrl,
  autoReplyRules,
  categories,
  marketplaces,
  amazonAssociatesTag,
  amazonAssociatesTags,
  defaultValues,
}: EditProductPanelsProps) {
  return (
    <ProductForm
      categories={categories}
      marketplaces={marketplaces}
      amazonAssociatesTag={amazonAssociatesTag}
      amazonAssociatesTags={amazonAssociatesTags}
      defaultValues={defaultValues}
    >
      {({ basics, fields }) => (
        <>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <ReplaceHeroImagePanel
                productId={productId}
                title={title}
                brand={brand}
                shortDescription={shortDescription}
                currentHeroUrl={currentHeroUrl}
                highlight={highlightHero}
              />
              {basics}
            </div>
            <MarketingVideosPanel
              className="min-w-0"
              productId={productId}
              videos={marketingVideos}
              platformHopUrls={platformHopUrls}
            />
          </div>
          <CommentAutoReplyPanel
            productId={productId}
            defaultReplyUrl={defaultReplyUrl}
            rules={autoReplyRules}
          />
          {fields}
        </>
      )}
    </ProductForm>
  );
}
