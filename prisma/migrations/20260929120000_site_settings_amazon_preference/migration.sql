-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "preferAmazonWhenCheapest" BOOLEAN NOT NULL DEFAULT false,
    "forceAmazonOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");
