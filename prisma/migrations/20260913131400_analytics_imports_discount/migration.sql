-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('URL', 'EXTERNAL_ID', 'BULK');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "discountPercentage" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "traffic_sessions" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "landingPath" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utm_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "term" TEXT,
    "content" TEXT,
    "landingPath" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sessionId" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "affiliateLinkId" TEXT,
    "marketplaceId" TEXT,
    "sessionId" TEXT,
    "destinationUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_imports" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "externalProductId" TEXT,
    "sourceUrl" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_sessions_anonymousId_idx" ON "traffic_sessions"("anonymousId");

-- CreateIndex
CREATE INDEX "traffic_sessions_startedAt_idx" ON "traffic_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "traffic_sessions_createdAt_idx" ON "traffic_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "utm_events_sessionId_idx" ON "utm_events"("sessionId");

-- CreateIndex
CREATE INDEX "utm_events_source_idx" ON "utm_events"("source");

-- CreateIndex
CREATE INDEX "utm_events_campaign_idx" ON "utm_events"("campaign");

-- CreateIndex
CREATE INDEX "utm_events_createdAt_idx" ON "utm_events"("createdAt");

-- CreateIndex
CREATE INDEX "product_views_productId_idx" ON "product_views"("productId");

-- CreateIndex
CREATE INDEX "product_views_sessionId_idx" ON "product_views"("sessionId");

-- CreateIndex
CREATE INDEX "product_views_createdAt_idx" ON "product_views"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_productId_idx" ON "affiliate_clicks"("productId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliateLinkId_idx" ON "affiliate_clicks"("affiliateLinkId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_marketplaceId_idx" ON "affiliate_clicks"("marketplaceId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_sessionId_idx" ON "affiliate_clicks"("sessionId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_createdAt_idx" ON "affiliate_clicks"("createdAt");

-- CreateIndex
CREATE INDEX "product_imports_marketplaceId_idx" ON "product_imports"("marketplaceId");

-- CreateIndex
CREATE INDEX "product_imports_externalProductId_idx" ON "product_imports"("externalProductId");

-- CreateIndex
CREATE INDEX "product_imports_status_idx" ON "product_imports"("status");

-- CreateIndex
CREATE INDEX "product_imports_createdAt_idx" ON "product_imports"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_links_externalProductId_idx" ON "affiliate_links"("externalProductId");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- AddForeignKey
ALTER TABLE "utm_events" ADD CONSTRAINT "utm_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "traffic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "traffic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "traffic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill stored discount from list vs sale price (same rounding as formatDiscountPercent).
UPDATE "products"
SET "discountPercentage" = ROUND((("originalPrice" - "displayPrice") / "originalPrice") * 100, 0)
WHERE "originalPrice" IS NOT NULL
  AND "originalPrice" > "displayPrice";
