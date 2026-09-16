-- CreateEnum
CREATE TYPE "PriceSyncTrigger" AS ENUM ('MANUAL', 'CRON');

-- CreateEnum
CREATE TYPE "PriceSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "price_sync_runs" (
    "id" TEXT NOT NULL,
    "status" "PriceSyncStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "PriceSyncTrigger" NOT NULL,
    "offerIds" TEXT[],
    "totalOffers" INTEGER NOT NULL DEFAULT 0,
    "processedOffers" INTEGER NOT NULL DEFAULT 0,
    "changedOffers" INTEGER NOT NULL DEFAULT 0,
    "failedOffers" INTEGER NOT NULL DEFAULT 0,
    "unchangedOffers" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_sync_changes" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "affiliateLinkId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "marketplaceCode" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "oldPrice" DECIMAL(10,2),
    "newPrice" DECIMAL(10,2),
    "oldOriginalPrice" DECIMAL(10,2),
    "newOriginalPrice" DECIMAL(10,2),
    "currency" TEXT,
    "oldAvailability" TEXT,
    "newAvailability" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_sync_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_sync_runs_status_idx" ON "price_sync_runs"("status");

-- CreateIndex
CREATE INDEX "price_sync_runs_createdAt_idx" ON "price_sync_runs"("createdAt");

-- CreateIndex
CREATE INDEX "price_sync_changes_runId_idx" ON "price_sync_changes"("runId");

-- CreateIndex
CREATE INDEX "price_sync_changes_productId_idx" ON "price_sync_changes"("productId");

-- CreateIndex
CREATE INDEX "price_sync_changes_affiliateLinkId_idx" ON "price_sync_changes"("affiliateLinkId");

-- AddForeignKey
ALTER TABLE "price_sync_runs" ADD CONSTRAINT "price_sync_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_sync_changes" ADD CONSTRAINT "price_sync_changes_runId_fkey" FOREIGN KEY ("runId") REFERENCES "price_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_sync_changes" ADD CONSTRAINT "price_sync_changes_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_sync_changes" ADD CONSTRAINT "price_sync_changes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
