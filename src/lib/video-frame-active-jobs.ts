/**
 * Persist in-flight Video creator Wan jobs across navigation (localStorage).
 * File/Blob fields are omitted — polling only needs predictionId + metadata.
 */

export type PersistedJobPhase =
  | "submitting"
  | "polling"
  | "saving"
  | "completed"
  | "failed";

export interface PersistedWanFrameJob {
  time: number;
  label: string;
  prompt: string;
  predictionId: string | null;
  phase: PersistedJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  size: string;
  seed: string;
  inferenceMs?: number;
  costUsd?: number | null;
}

export interface PersistedWanClipJob {
  spanId: string;
  spanLabel: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  predictionId: string | null;
  phase: PersistedJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  timeSec: number;
  inferenceMs?: number;
  costUsd?: number | null;
}

export interface PersistedWanVideoEditJob {
  spanId: string;
  spanLabel: string;
  prompt: string;
  duration: number | null;
  resolution: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  cutStartSec: number;
  cutEndSec: number;
  predictionId: string | null;
  phase: PersistedJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  timeSec: number;
  inferenceMs?: number;
  costUsd?: number | null;
}

export interface VideoFrameActiveJobsSnapshot {
  frameJobs: Record<string, PersistedWanFrameJob>;
  clipJobs: Record<string, PersistedWanClipJob>;
  videoEditJobs: Record<string, PersistedWanVideoEditJob>;
  updatedAt: number;
}

const STORAGE_PREFIX = "radarcut-video-frame-jobs:v1:";

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function shouldPersistJob(job: {
  phase: string;
  predictionId: string | null;
}): boolean {
  if (job.phase === "completed") return false;
  if (job.phase === "failed") return true;
  if (job.phase === "submitting" && !job.predictionId) {
    // Mid-upload — cannot resume WaveSpeed without a prediction id.
    return false;
  }
  return (
    job.phase === "submitting" ||
    job.phase === "polling" ||
    job.phase === "saving" ||
    job.phase === "failed"
  );
}

function resumePhase<T extends { phase: PersistedJobPhase; status: string | null }>(
  job: T,
): T {
  if (job.phase !== "saving") return job;
  // Re-enter polling so the next poll can finish / re-save the output.
  return {
    ...job,
    phase: "polling",
    status: job.status ?? "completed",
  };
}

export function toPersistedFrameJob(job: {
  time: number;
  label: string;
  prompt: string;
  predictionId: string | null;
  phase: PersistedJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  size: string;
  seed: string;
  inferenceMs?: number;
  costUsd?: number | null;
}): PersistedWanFrameJob | null {
  if (!shouldPersistJob(job)) return null;
  return {
    time: job.time,
    label: job.label,
    prompt: job.prompt,
    predictionId: job.predictionId,
    phase: job.phase,
    status: job.status,
    apiProgress: job.apiProgress,
    progress: job.progress,
    error: job.error,
    outputUrl: job.outputUrl,
    startedAt: job.startedAt,
    historyId: job.historyId,
    size: job.size,
    seed: job.seed,
    inferenceMs: job.inferenceMs,
    costUsd: job.costUsd,
  };
}

export function toPersistedClipJob(job: {
  spanId: string;
  spanLabel: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  predictionId: string | null;
  phase: PersistedJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  timeSec: number;
  inferenceMs?: number;
  costUsd?: number | null;
}): PersistedWanClipJob | null {
  if (!shouldPersistJob(job)) return null;
  return {
    spanId: job.spanId,
    spanLabel: job.spanLabel,
    prompt: job.prompt,
    duration: job.duration,
    resolution: job.resolution,
    aspectRatio: job.aspectRatio,
    seed: job.seed,
    generateAudio: job.generateAudio,
    enablePromptExpansion: job.enablePromptExpansion,
    predictionId: job.predictionId,
    phase: job.phase,
    status: job.status,
    apiProgress: job.apiProgress,
    progress: job.progress,
    error: job.error,
    outputUrl: job.outputUrl,
    startedAt: job.startedAt,
    historyId: job.historyId,
    timeSec: job.timeSec,
    inferenceMs: job.inferenceMs,
    costUsd: job.costUsd,
  };
}

export function toPersistedVideoEditJob(job: {
  spanId: string;
  spanLabel: string;
  prompt: string;
  duration: number | null;
  resolution: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  cutStartSec: number;
  cutEndSec: number;
  predictionId: string | null;
  phase: PersistedJobPhase;
  status: string | null;
  apiProgress: number | null;
  progress: number;
  error: string | null;
  outputUrl: string | null;
  startedAt: number;
  historyId: string;
  timeSec: number;
  inferenceMs?: number;
  costUsd?: number | null;
}): PersistedWanVideoEditJob | null {
  if (!shouldPersistJob(job)) return null;
  return {
    spanId: job.spanId,
    spanLabel: job.spanLabel,
    prompt: job.prompt,
    duration: job.duration,
    resolution: job.resolution,
    seed: job.seed,
    generateAudio: job.generateAudio,
    enablePromptExpansion: job.enablePromptExpansion,
    cutStartSec: job.cutStartSec,
    cutEndSec: job.cutEndSec,
    predictionId: job.predictionId,
    phase: job.phase,
    status: job.status,
    apiProgress: job.apiProgress,
    progress: job.progress,
    error: job.error,
    outputUrl: job.outputUrl,
    startedAt: job.startedAt,
    historyId: job.historyId,
    timeSec: job.timeSec,
    inferenceMs: job.inferenceMs,
    costUsd: job.costUsd,
  };
}

export function serializeFrameJobs(
  jobs: Record<string, Parameters<typeof toPersistedFrameJob>[0]>,
): Record<string, PersistedWanFrameJob> {
  const out: Record<string, PersistedWanFrameJob> = {};
  for (const [key, job] of Object.entries(jobs)) {
    const persisted = toPersistedFrameJob(job);
    if (persisted) out[key] = persisted;
  }
  return out;
}

export function serializeClipJobs(
  jobs: Record<string, Parameters<typeof toPersistedClipJob>[0]>,
): Record<string, PersistedWanClipJob> {
  const out: Record<string, PersistedWanClipJob> = {};
  for (const [key, job] of Object.entries(jobs)) {
    const persisted = toPersistedClipJob(job);
    if (persisted) out[key] = persisted;
  }
  return out;
}

export function serializeVideoEditJobs(
  jobs: Record<string, Parameters<typeof toPersistedVideoEditJob>[0]>,
): Record<string, PersistedWanVideoEditJob> {
  const out: Record<string, PersistedWanVideoEditJob> = {};
  for (const [key, job] of Object.entries(jobs)) {
    const persisted = toPersistedVideoEditJob(job);
    if (persisted) out[key] = persisted;
  }
  return out;
}

export function hydrateFrameJobs(
  jobs: Record<string, PersistedWanFrameJob> | undefined,
): Record<string, PersistedWanFrameJob> {
  if (!jobs) return {};
  const out: Record<string, PersistedWanFrameJob> = {};
  for (const [key, job] of Object.entries(jobs)) {
    if (!shouldPersistJob(job)) continue;
    out[key] = resumePhase(job);
  }
  return out;
}

export function hydrateClipJobs(
  jobs: Record<string, PersistedWanClipJob> | undefined,
): Record<string, PersistedWanClipJob> {
  if (!jobs) return {};
  const out: Record<string, PersistedWanClipJob> = {};
  for (const [key, job] of Object.entries(jobs)) {
    if (!shouldPersistJob(job)) continue;
    out[key] = resumePhase(job);
  }
  return out;
}

export function hydrateVideoEditJobs(
  jobs: Record<string, PersistedWanVideoEditJob> | undefined,
): Record<string, PersistedWanVideoEditJob> {
  if (!jobs) return {};
  const out: Record<string, PersistedWanVideoEditJob> = {};
  for (const [key, job] of Object.entries(jobs)) {
    if (!shouldPersistJob(job)) continue;
    out[key] = resumePhase(job);
  }
  return out;
}

export function loadVideoFrameActiveJobs(
  projectId: string,
): VideoFrameActiveJobsSnapshot | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VideoFrameActiveJobsSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      frameJobs: parsed.frameJobs ?? {},
      clipJobs: parsed.clipJobs ?? {},
      videoEditJobs: parsed.videoEditJobs ?? {},
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveVideoFrameActiveJobs(
  projectId: string,
  snapshot: Omit<VideoFrameActiveJobsSnapshot, "updatedAt">,
): void {
  if (typeof window === "undefined" || !projectId) return;
  const payload: VideoFrameActiveJobsSnapshot = {
    frameJobs: snapshot.frameJobs,
    clipJobs: snapshot.clipJobs,
    videoEditJobs: snapshot.videoEditJobs,
    updatedAt: Date.now(),
  };
  const empty =
    Object.keys(payload.frameJobs).length === 0 &&
    Object.keys(payload.clipJobs).length === 0 &&
    Object.keys(payload.videoEditJobs).length === 0;
  try {
    if (empty) {
      window.localStorage.removeItem(storageKey(projectId));
      return;
    }
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}
