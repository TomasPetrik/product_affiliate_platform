-- CreateEnum
CREATE TYPE "VideoFrameAssetKind" AS ENUM ('FRAME', 'THUMBNAIL');

-- CreateTable
CREATE TABLE "video_frame_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "videoFileName" TEXT,
    "videoMimeType" TEXT,
    "videoPath" TEXT,
    "videoBytes" BIGINT NOT NULL DEFAULT 0,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoWidth" INTEGER,
    "videoHeight" INTEGER,
    "spansJson" JSONB NOT NULL DEFAULT '[]',
    "framesBytes" BIGINT NOT NULL DEFAULT 0,
    "thumbnailsBytes" BIGINT NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_frame_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_frame_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "VideoFrameAssetKind" NOT NULL,
    "spanId" TEXT,
    "frameIndex" INTEGER,
    "timeSec" DOUBLE PRECISION NOT NULL,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_frame_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_frame_projects_updatedAt_idx" ON "video_frame_projects"("updatedAt");

-- CreateIndex
CREATE INDEX "video_frame_assets_projectId_kind_idx" ON "video_frame_assets"("projectId", "kind");

-- AddForeignKey
ALTER TABLE "video_frame_assets" ADD CONSTRAINT "video_frame_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "video_frame_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
