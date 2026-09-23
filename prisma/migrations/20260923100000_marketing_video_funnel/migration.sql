-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "MarketingVideoSyncStatus" AS ENUM ('PENDING', 'OK', 'ERROR');

-- CreateTable
CREATE TABLE "product_marketing_videos" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_marketing_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_marketing_video_posts" (
    "id" TEXT NOT NULL,
    "marketingVideoId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "permalinkUrl" TEXT,
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "MarketingVideoSyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_marketing_video_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_marketing_video_post_snapshots" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "viewCount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_marketing_video_post_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_marketing_videos_productId_idx" ON "product_marketing_videos"("productId");

-- CreateIndex
CREATE INDEX "product_marketing_videos_utmCampaign_idx" ON "product_marketing_videos"("utmCampaign");

-- CreateIndex
CREATE INDEX "product_marketing_video_posts_platform_externalId_idx" ON "product_marketing_video_posts"("platform", "externalId");

-- CreateIndex
CREATE INDEX "product_marketing_video_posts_syncStatus_idx" ON "product_marketing_video_posts"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "product_marketing_video_posts_marketingVideoId_platform_key" ON "product_marketing_video_posts"("marketingVideoId", "platform");

-- CreateIndex
CREATE INDEX "product_marketing_video_post_snapshots_day_idx" ON "product_marketing_video_post_snapshots"("day");

-- CreateIndex
CREATE UNIQUE INDEX "product_marketing_video_post_snapshots_postId_day_key" ON "product_marketing_video_post_snapshots"("postId", "day");

-- AddForeignKey
ALTER TABLE "product_marketing_videos" ADD CONSTRAINT "product_marketing_videos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_marketing_video_posts" ADD CONSTRAINT "product_marketing_video_posts_marketingVideoId_fkey" FOREIGN KEY ("marketingVideoId") REFERENCES "product_marketing_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_marketing_video_post_snapshots" ADD CONSTRAINT "product_marketing_video_post_snapshots_postId_fkey" FOREIGN KEY ("postId") REFERENCES "product_marketing_video_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
