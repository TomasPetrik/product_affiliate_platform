-- AlterEnum
ALTER TYPE "AnalyticsEventType" ADD VALUE 'SEARCH_RESULT_CLICK';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'NO_SEARCH_RESULTS';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'RETAILER_OFFER_VIEW';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'SHARE';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'AFFILIATE_CONVERSION';

-- CreateEnum
CREATE TYPE "AnalyticsDimension" AS ENUM ('OVERALL', 'COUNTRY', 'SOURCE', 'CAMPAIGN', 'PRODUCT', 'RETAILER', 'DEVICE', 'SEARCH');

-- AlterTable
ALTER TABLE "traffic_sessions" ADD COLUMN "region" VARCHAR(64),
ADD COLUMN "firstSource" TEXT,
ADD COLUMN "firstMedium" TEXT,
ADD COLUMN "firstCampaign" TEXT,
ADD COLUMN "firstContent" TEXT,
ADD COLUMN "firstTerm" TEXT,
ADD COLUMN "lastSource" TEXT,
ADD COLUMN "lastMedium" TEXT,
ADD COLUMN "lastCampaign" TEXT,
ADD COLUMN "lastContent" TEXT,
ADD COLUMN "lastTerm" TEXT;

-- AlterTable
ALTER TABLE "analytics_events" ADD COLUMN "resultCount" INTEGER,
ADD COLUMN "firstUtmSource" TEXT,
ADD COLUMN "firstUtmMedium" TEXT,
ADD COLUMN "firstUtmCampaign" TEXT,
ADD COLUMN "firstUtmContent" TEXT,
ADD COLUMN "firstUtmTerm" TEXT,
ADD COLUMN "sourceNormalized" TEXT,
ADD COLUMN "browser" TEXT,
ADD COLUMN "operatingSystem" TEXT,
ADD COLUMN "language" VARCHAR(16),
ADD COLUMN "region" VARCHAR(64),
ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "traffic_sessions_country_idx" ON "traffic_sessions"("country");

-- CreateIndex
CREATE INDEX "analytics_events_affiliateLinkId_createdAt_idx" ON "analytics_events"("affiliateLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_sourceNormalized_createdAt_idx" ON "analytics_events"("sourceNormalized", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_country_createdAt_idx" ON "analytics_events"("country", "createdAt");

-- CreateTable
CREATE TABLE "analytics_daily_metrics" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "dimension" "AnalyticsDimension" NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "productViews" INTEGER NOT NULL DEFAULT 0,
    "offerViews" INTEGER NOT NULL DEFAULT 0,
    "affiliateClicks" INTEGER NOT NULL DEFAULT 0,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "zeroResultSearches" INTEGER NOT NULL DEFAULT 0,
    "searchResultClicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_metrics_day_dimension_key_key" ON "analytics_daily_metrics"("day", "dimension", "key");

-- CreateIndex
CREATE INDEX "analytics_daily_metrics_dimension_key_day_idx" ON "analytics_daily_metrics"("dimension", "key", "day");

-- CreateIndex
CREATE INDEX "analytics_daily_metrics_day_idx" ON "analytics_daily_metrics"("day");
