-- CreateEnum
CREATE TYPE "RevenueSource" AS ENUM ('MANUAL_IMPORT', 'NETWORK_REPORT');

-- CreateTable
CREATE TABLE "revenue_entries" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "productId" TEXT,
    "source" "RevenueSource" NOT NULL DEFAULT 'MANUAL_IMPORT',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderCount" INTEGER,
    "reportedClicks" INTEGER,
    "occurredOn" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revenue_entries_marketplaceId_idx" ON "revenue_entries"("marketplaceId");

-- CreateIndex
CREATE INDEX "revenue_entries_productId_idx" ON "revenue_entries"("productId");

-- CreateIndex
CREATE INDEX "revenue_entries_occurredOn_idx" ON "revenue_entries"("occurredOn");

-- CreateIndex
CREATE INDEX "revenue_entries_createdAt_idx" ON "revenue_entries"("createdAt");

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
