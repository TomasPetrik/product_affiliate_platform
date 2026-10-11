-- AlterTable
ALTER TABLE "video_frame_projects" ADD COLUMN "videosJson" JSONB NOT NULL DEFAULT '[]';

-- Backfill from legacy single-video columns
UPDATE "video_frame_projects"
SET "videosJson" = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-source',
    'fileName', COALESCE(NULLIF("videoFileName", ''), 'source.mp4'),
    'mimeType', "videoMimeType",
    'path', "videoPath",
    'bytes', "videoBytes"::float8,
    'durationSec', "durationSec",
    'width', "videoWidth",
    'height', "videoHeight"
  )
)
WHERE "videoPath" IS NOT NULL
  AND "videoPath" <> ''
  AND "videosJson" = '[]'::jsonb;
