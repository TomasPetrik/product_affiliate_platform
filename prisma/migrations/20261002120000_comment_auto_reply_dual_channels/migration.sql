-- AlterTable
ALTER TABLE "comment_auto_reply_rules" ADD COLUMN "publicReplyMessage" TEXT NOT NULL DEFAULT 'Just sent you a DM with the link ✨';
ALTER TABLE "comment_auto_reply_rules" ADD COLUMN "dmReplyMessage" TEXT NOT NULL DEFAULT 'Enjoy ✨😊';
ALTER TABLE "comment_auto_reply_rules" ADD COLUMN "enablePublicReply" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "comment_auto_reply_rules" ADD COLUMN "enablePrivateDm" BOOLEAN NOT NULL DEFAULT true;

-- Backfill public message from the previous single replyMessage column when present.
UPDATE "comment_auto_reply_rules"
SET "publicReplyMessage" = "replyMessage"
WHERE "replyMessage" IS NOT NULL AND TRIM("replyMessage") <> '';

-- Drop legacy column
ALTER TABLE "comment_auto_reply_rules" DROP COLUMN "replyMessage";
