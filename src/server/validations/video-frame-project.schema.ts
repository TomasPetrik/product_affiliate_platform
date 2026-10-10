import { z } from "zod";

export const frameSpanSchema = z.object({
  id: z.string().min(1).max(80),
  start: z.number().finite().min(0),
  end: z.number().finite().min(0),
  frameCount: z.number().int().min(1).max(120),
});

export const videoFrameProjectNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");

export const saveVideoFrameProjectSchema = z.object({
  projectId: z.string().min(1),
  name: videoFrameProjectNameSchema,
  spans: z.array(frameSpanSchema).max(50),
  durationSec: z.number().finite().min(0).max(60 * 60 * 6).optional(),
  videoWidth: z.number().int().positive().max(10_000).nullable().optional(),
  videoHeight: z.number().int().positive().max(10_000).nullable().optional(),
});

export const savedFrameMetaSchema = z.object({
  spanId: z.string().min(1).max(80),
  frameIndex: z.number().int().min(0).max(500),
  timeSec: z.number().finite().min(0),
  fileName: z.string().min(1).max(200),
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional(),
});

export const mergeVideoFrameSegmentSchema = z
  .object({
    assetId: z.string().min(1),
    trimStartSec: z.number().finite().min(0).default(0),
    trimEndSec: z.number().finite().positive().optional(),
  })
  .refine(
    (value) =>
      value.trimEndSec == null ||
      value.trimEndSec > value.trimStartSec + 0.04,
    {
      message: "Each trimmed clip must be longer than 0.04s.",
      path: ["trimEndSec"],
    },
  );

export const mergeVideoFrameClipsSchema = z
  .object({
    projectId: z.string().min(1),
    assetIds: z
      .array(z.string().min(1))
      .min(2, "Pick at least two clips to merge.")
      .max(40, "Too many clips to merge.")
      .optional(),
    segments: z
      .array(mergeVideoFrameSegmentSchema)
      .min(2, "Pick at least two clips to merge.")
      .max(40, "Too many clips to merge.")
      .optional(),
    stripAudio: z.boolean().optional(),
    exportQuality: z.enum(["720p", "1080p", "2K"]).optional(),
  })
  .refine(
    (value) =>
      (value.segments != null && value.segments.length >= 2) ||
      (value.assetIds != null && value.assetIds.length >= 2),
    { message: "Pick at least two clips to merge." },
  );

export const videoFrameMergerSegmentStateSchema = z.object({
  instanceId: z.string().min(1).max(80),
  assetId: z.string().min(1),
  trimStartSec: z.number().finite().min(0),
  trimEndSec: z.number().finite().positive(),
  durationSec: z.number().finite().positive(),
});

export const saveVideoFrameMergerStateSchema = z.object({
  projectId: z.string().min(1),
  state: z.object({
    segments: z.array(videoFrameMergerSegmentStateSchema).max(40),
    selectedId: z.string().min(1).max(80).nullable(),
    playheadSec: z.number().finite().min(0),
    previewSegIndex: z.number().int().min(0).max(40),
    zoom: z.number().finite().min(0.5).max(8),
    stripAudio: z.boolean().optional(),
    exportQuality: z.enum(["720p", "1080p", "2K"]).optional(),
  }),
});
