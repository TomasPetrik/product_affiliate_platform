-- AlterEnum
ALTER TYPE "VideoFrameAssetKind" ADD VALUE 'EDITED';

-- AlterTable
ALTER TABLE "video_frame_projects" ADD COLUMN "editedBytes" BIGINT NOT NULL DEFAULT 0;
