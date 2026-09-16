-- AlterTable
ALTER TABLE "products" ADD COLUMN "publicId" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "products_publicId_key" ON "products"("publicId");
