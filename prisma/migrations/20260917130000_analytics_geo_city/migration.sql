-- AlterTable
ALTER TABLE "traffic_sessions" ADD COLUMN "city" VARCHAR(64);

-- AlterTable
ALTER TABLE "analytics_events" ADD COLUMN "city" VARCHAR(64);

-- CreateIndex
CREATE INDEX "analytics_events_country_city_createdAt_idx" ON "analytics_events"("country", "city", "createdAt");
