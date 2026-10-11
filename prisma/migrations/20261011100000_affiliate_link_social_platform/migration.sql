-- Per-platform Amazon Associates hops (Instagram / Facebook / YouTube / TikTok).
ALTER TABLE "affiliate_links" ADD COLUMN "socialPlatform" "SocialPlatform";

DROP INDEX IF EXISTS "affiliate_links_productId_marketplaceId_externalProductId_key";
DROP INDEX IF EXISTS "affiliate_links_marketplaceId_externalProductId_key";

-- NULLS NOT DISTINCT so legacy rows with NULL socialPlatform stay unique per ASIN/item.
CREATE UNIQUE INDEX "affiliate_links_productId_marketplaceId_externalProductId_socialPlatform_key"
  ON "affiliate_links" ("productId", "marketplaceId", "externalProductId", "socialPlatform") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "affiliate_links_marketplaceId_externalProductId_socialPlatform_key"
  ON "affiliate_links" ("marketplaceId", "externalProductId", "socialPlatform") NULLS NOT DISTINCT;

CREATE INDEX "affiliate_links_socialPlatform_idx" ON "affiliate_links" ("socialPlatform");
