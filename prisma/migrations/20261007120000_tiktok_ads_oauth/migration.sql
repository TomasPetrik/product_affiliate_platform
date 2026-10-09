-- CreateEnum
CREATE TYPE "TikTokAdsConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "tiktok_ads_oauth_connections" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "advertiserIds" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "status" "TikTokAdsConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_ads_oauth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_ads_oauth_connections_key_key" ON "tiktok_ads_oauth_connections"("key");
