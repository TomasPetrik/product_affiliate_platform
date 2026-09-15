-- AlterEnum
ALTER TYPE "MarketplaceCode" ADD VALUE 'WALMART';
ALTER TYPE "MarketplaceCode" ADD VALUE 'BEST_BUY';
ALTER TYPE "MarketplaceCode" ADD VALUE 'TARGET';
ALTER TYPE "MarketplaceCode" ADD VALUE 'OTHER';

-- AlterTable: canonical product identifiers for conservative matching.
ALTER TABLE "products" ADD COLUMN "modelNumber" TEXT;
ALTER TABLE "products" ADD COLUMN "gtin" TEXT;
ALTER TABLE "products" ADD COLUMN "mpn" TEXT;

CREATE INDEX "products_gtin_idx" ON "products"("gtin");
CREATE INDEX "products_mpn_idx" ON "products"("mpn");
CREATE INDEX "products_brand_modelNumber_idx" ON "products"("brand", "modelNumber");

-- AlterTable: retailer-offer fields on affiliate_links (existing Product ↔ Marketplace offer entity).
ALTER TABLE "affiliate_links" ADD COLUMN "listingTitle" TEXT;
ALTER TABLE "affiliate_links" ADD COLUMN "sellerName" TEXT;
ALTER TABLE "affiliate_links" ADD COLUMN "condition" TEXT;
ALTER TABLE "affiliate_links" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "affiliate_links" ADD COLUMN "metadata" JSONB;
ALTER TABLE "affiliate_links" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "affiliate_links" ADD COLUMN "lastKnownOriginalPrice" DECIMAL(10,2);

DROP INDEX IF EXISTS "affiliate_links_productId_marketplaceId_key";

CREATE UNIQUE INDEX "affiliate_links_productId_marketplaceId_externalProductId_key"
  ON "affiliate_links"("productId", "marketplaceId", "externalProductId");

CREATE UNIQUE INDEX "affiliate_links_marketplaceId_externalProductId_key"
  ON "affiliate_links"("marketplaceId", "externalProductId");

CREATE INDEX "affiliate_links_lastSyncedAt_idx" ON "affiliate_links"("lastSyncedAt");
