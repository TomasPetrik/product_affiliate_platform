"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createVideoFrameProject,
  deleteVideoFrameProject,
  getVideoFrameProject,
  replaceVideoFrameProjectFrames,
  saveVideoFrameClip,
  saveVideoFrameEdit,
  updateVideoFrameProject,
  type VideoFrameProjectDetail,
} from "@/server/services/video-frame-project.service";
import {
  saveVideoFrameProjectSchema,
  savedFrameMetaSchema,
  videoFrameProjectNameSchema,
} from "@/server/validations/video-frame-project.schema";

export interface VideoFrameProjectActionState {
  error?: string;
  project?: VideoFrameProjectDetail;
  ok?: boolean;
}

function revalidateVideoFrameProjects(projectId?: string) {
  revalidatePath("/admin/tools/video-frames");
  if (projectId) {
    revalidatePath(`/admin/tools/video-frames/${projectId}`);
  }
}

export async function createVideoFrameProjectAction(
  _prev: VideoFrameProjectActionState,
  formData: FormData,
): Promise<VideoFrameProjectActionState> {
  const session = await requireAdminSession();

  const nameParsed = videoFrameProjectNameSchema.safeParse(formData.get("name") ?? "");
  if (!nameParsed.success) {
    return { error: nameParsed.error.issues[0]?.message ?? "Invalid name." };
  }

  const video = formData.get("video");
  if (!(video instanceof File) || video.size <= 0) {
    return { error: "Choose a video file." };
  }

  const result = await createVideoFrameProject({ name: nameParsed.data, video });
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    actor: session,
    action: "video_frame_project.create",
    entityType: "VideoFrameProject",
    entityId: result.id,
    after: { name: result.name, videoFileName: result.videoFileName, videoBytes: result.videoBytes },
  });

  revalidateVideoFrameProjects(result.id);
  return { ok: true, project: result };
}

export async function saveVideoFrameProjectAction(
  input: unknown,
): Promise<VideoFrameProjectActionState> {
  const session = await requireAdminSession();
  const parsed = saveVideoFrameProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid project data." };
  }

  const result = await updateVideoFrameProject(parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    actor: session,
    action: "video_frame_project.update",
    entityType: "VideoFrameProject",
    entityId: result.id,
    after: {
      name: result.name,
      spanCount: result.spans.length,
      durationSec: result.durationSec,
    },
  });

  revalidateVideoFrameProjects(result.id);
  return { ok: true, project: result };
}

export async function saveVideoFrameProjectFramesAction(
  formData: FormData,
): Promise<VideoFrameProjectActionState> {
  const session = await requireAdminSession();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) {
    return { error: "Missing project id." };
  }

  const metaRaw = formData.get("framesMeta");
  if (typeof metaRaw !== "string") {
    return { error: "Missing frame metadata." };
  }

  let metaJson: unknown;
  try {
    metaJson = JSON.parse(metaRaw);
  } catch {
    return { error: "Invalid frame metadata." };
  }

  const metaParsed = savedFrameMetaSchema.array().max(500).safeParse(metaJson);
  if (!metaParsed.success) {
    return { error: metaParsed.error.issues[0]?.message ?? "Invalid frame metadata." };
  }

  const files = formData
    .getAll("frameFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length !== metaParsed.data.length) {
    return { error: "Frame files and metadata count do not match." };
  }

  const frames = metaParsed.data.map((meta, index) => ({
    file: files[index]!,
    spanId: meta.spanId,
    frameIndex: meta.frameIndex,
    timeSec: meta.timeSec,
    fileName: meta.fileName,
    width: meta.width,
    height: meta.height,
  }));

  const result = await replaceVideoFrameProjectFrames({ projectId, frames });
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    actor: session,
    action: "video_frame_project.save_frames",
    entityType: "VideoFrameProject",
    entityId: result.id,
    after: {
      frameCount: result.assets.filter((asset) => asset.kind === "FRAME").length,
      framesBytes: result.framesBytes,
      thumbnailsBytes: result.thumbnailsBytes,
      totalBytes: result.totalBytes,
    },
  });

  revalidateVideoFrameProjects(result.id);
  return { ok: true, project: result };
}

export async function saveVideoFrameEditAction(input: {
  projectId: string;
  timeSec: number;
  spanId?: string | null;
  frameIndex?: number | null;
  sourceUrl: string;
  prompt?: string;
}): Promise<VideoFrameProjectActionState> {
  const session = await requireAdminSession();
  if (!input.projectId || !input.sourceUrl?.trim()) {
    return { error: "Missing project or edited image URL." };
  }

  const result = await saveVideoFrameEdit({
    projectId: input.projectId,
    timeSec: input.timeSec,
    spanId: input.spanId,
    frameIndex: input.frameIndex,
    sourceUrl: input.sourceUrl.trim(),
    prompt: input.prompt,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    actor: session,
    action: "video_frame_project.save_edit",
    entityType: "VideoFrameProject",
    entityId: result.id,
    after: {
      timeSec: input.timeSec,
      editedBytes: result.editedBytes,
      totalBytes: result.totalBytes,
    },
  });

  revalidateVideoFrameProjects(result.id);
  return { ok: true, project: result };
}

export async function saveVideoFrameClipAction(input: {
  projectId: string;
  spanId: string;
  timeSec: number;
  sourceUrl: string;
  provider: "wan" | "krea";
  prompt?: string;
}): Promise<VideoFrameProjectActionState> {
  const session = await requireAdminSession();
  if (!input.projectId || !input.sourceUrl?.trim() || !input.spanId?.trim()) {
    return { error: "Missing project, span, or clip URL." };
  }

  const result = await saveVideoFrameClip({
    projectId: input.projectId,
    spanId: input.spanId.trim(),
    timeSec: input.timeSec,
    sourceUrl: input.sourceUrl.trim(),
    provider: input.provider,
    prompt: input.prompt,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    actor: session,
    action: "video_frame_project.save_clip",
    entityType: "VideoFrameProject",
    entityId: result.id,
    after: {
      spanId: input.spanId,
      provider: input.provider,
      clipsBytes: result.clipsBytes,
      totalBytes: result.totalBytes,
    },
  });

  revalidateVideoFrameProjects(result.id);
  return { ok: true, project: result };
}

export async function deleteVideoFrameProjectAction(
  projectId: string,
): Promise<VideoFrameProjectActionState> {
  const session = await requireAdminSession();
  const before = await getVideoFrameProject(projectId);
  if (!before) {
    return { error: "Project not found." };
  }

  const result = await deleteVideoFrameProject(projectId);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    actor: session,
    action: "video_frame_project.delete",
    entityType: "VideoFrameProject",
    entityId: projectId,
    before: { name: before.name, totalBytes: before.totalBytes },
  });

  revalidateVideoFrameProjects();
  return { ok: true };
}
