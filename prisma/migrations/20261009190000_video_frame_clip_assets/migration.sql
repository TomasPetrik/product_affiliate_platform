-- AlterEnum
ALTER TYPE "VideoFrameAssetKind" ADD VALUE 'CLIP';

-- AlterTable
ALTER TABLE "video_frame_projects" ADD COLUMN "clipsBytes" BIGINT NOT NULL DEFAULT 0;
