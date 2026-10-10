-- AlterEnum
ALTER TYPE "VideoFrameAssetKind" ADD VALUE 'MERGED';

-- AlterTable
ALTER TABLE "video_frame_assets" ADD COLUMN "label" TEXT;
