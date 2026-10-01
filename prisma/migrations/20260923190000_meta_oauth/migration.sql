-- CreateEnum
CREATE TYPE "MetaConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "meta_oauth_connections" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "facebookUserId" TEXT NOT NULL,
    "facebookUserName" TEXT,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "pageAccessTokenEnc" TEXT NOT NULL,
    "userAccessTokenEnc" TEXT NOT NULL,
    "userTokenExpiresAt" TIMESTAMP(3),
    "pageTokenExpiresAt" TIMESTAMP(3),
    "instagramBusinessAccountId" TEXT,
    "instagramUsername" TEXT,
    "scopes" TEXT NOT NULL,
    "status" "MetaConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_oauth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_cached_media" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "permalinkUrl" TEXT,
    "mediaType" TEXT,
    "createTime" TIMESTAMP(3),
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_cached_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_oauth_connections_key_key" ON "meta_oauth_connections"("key");

-- CreateIndex
CREATE INDEX "meta_cached_media_platform_viewCount_idx" ON "meta_cached_media"("platform", "viewCount");

-- CreateIndex
CREATE UNIQUE INDEX "meta_cached_media_platform_externalId_key" ON "meta_cached_media"("platform", "externalId");
