-- CreateEnum
CREATE TYPE "CommentAutoReplyStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'ERROR');

-- CreateTable
CREATE TABLE "comment_auto_reply_rules" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "replyMessage" TEXT NOT NULL,
    "replyUrl" TEXT NOT NULL,
    "enableInstagram" BOOLEAN NOT NULL DEFAULT true,
    "enableFacebook" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_auto_reply_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "productId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "mediaExternalId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "commentText" TEXT,
    "replyCommentId" TEXT,
    "replyBody" TEXT,
    "status" "CommentAutoReplyStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_auto_reply_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_auto_reply_rules_productId_isActive_idx" ON "comment_auto_reply_rules"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "comment_auto_reply_logs_commentId_key" ON "comment_auto_reply_logs"("commentId");

-- CreateIndex
CREATE INDEX "comment_auto_reply_logs_productId_idx" ON "comment_auto_reply_logs"("productId");

-- CreateIndex
CREATE INDEX "comment_auto_reply_logs_platform_mediaExternalId_idx" ON "comment_auto_reply_logs"("platform", "mediaExternalId");

-- CreateIndex
CREATE INDEX "comment_auto_reply_logs_createdAt_idx" ON "comment_auto_reply_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "comment_auto_reply_rules" ADD CONSTRAINT "comment_auto_reply_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_auto_reply_logs" ADD CONSTRAINT "comment_auto_reply_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "comment_auto_reply_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_auto_reply_logs" ADD CONSTRAINT "comment_auto_reply_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
