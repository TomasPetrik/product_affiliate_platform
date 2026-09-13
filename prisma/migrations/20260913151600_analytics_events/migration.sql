-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'PRODUCT_VIEW', 'CATEGORY_VIEW', 'SEARCH', 'AFFILIATE_CLICK', 'OUTBOUND_CLICK');

-- AlterTable
ALTER TABLE "traffic_sessions" ADD COLUMN "deviceType" "DeviceType",
ADD COLUMN "country" CHAR(2);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "productId" TEXT,
    "categoryId" TEXT,
    "affiliateLinkId" TEXT,
    "path" TEXT,
    "landingPath" TEXT,
    "referrer" TEXT,
    "searchQuery" TEXT,
    "destinationUrl" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "deviceType" "DeviceType",
    "country" CHAR(2),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_dedupeKey_key" ON "analytics_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "analytics_events_type_createdAt_idx" ON "analytics_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_visitorId_createdAt_idx" ON "analytics_events"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");

-- CreateIndex
CREATE INDEX "analytics_events_productId_createdAt_idx" ON "analytics_events"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_categoryId_createdAt_idx" ON "analytics_events"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_utmSource_createdAt_idx" ON "analytics_events"("utmSource", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_utmCampaign_createdAt_idx" ON "analytics_events"("utmCampaign", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "traffic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
