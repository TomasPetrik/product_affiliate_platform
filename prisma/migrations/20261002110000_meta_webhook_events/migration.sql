-- CreateTable
CREATE TABLE "meta_webhook_events" (
    "id" TEXT NOT NULL,
    "object" TEXT,
    "fields" TEXT,
    "summary" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "commentEventCount" INTEGER NOT NULL DEFAULT 0,
    "signatureOk" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_webhook_events_createdAt_idx" ON "meta_webhook_events"("createdAt");
