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
