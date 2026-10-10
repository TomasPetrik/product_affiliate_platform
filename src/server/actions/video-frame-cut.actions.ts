"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isLocalVideoFrameUpload,
  LOCAL_VIDEO_FRAME_UPLOAD_PREFIX,
  publicVideoFramePath,
  videoFrameProjectDir,
  videoFrameProjectsUploadsDir,
} from "@/lib/video-frame-project-paths";
import { WAN_VIDEO_EDIT_INPUT_MAX_SEC } from "@/lib/wan-video-edit";
import {
  cutVideoSegment,
  VideoCutError,
} from "@/server/services/video-cut.service";

export interface PreviewSpanCutState {
  error?: string;
  path?: string;
  bytes?: number;
  startSec?: number;
  endSec?: number;
}

function absoluteFromPublicUpload(publicPath: string): string | null {
  if (!isLocalVideoFrameUpload(publicPath)) return null;
  const relative = publicPath.slice(LOCAL_VIDEO_FRAME_UPLOAD_PREFIX.length);
  if (!relative || relative.includes("..")) return null;
  return path.join(videoFrameProjectsUploadsDir(), relative);
}

/**
 * Cut first→last frame range from a Video creator project and store a preview MP4
 * under `cuts/` so the admin UI can play the exact input that Wan video edit uses.
 */
export async function previewSpanCutAction(input: {
  projectId: string;
  startSec: number;
  endSec: number;
}): Promise<PreviewSpanCutState> {
  await requireAdminSession();

  const projectId = input.projectId?.trim();
  if (!projectId) {
    return { error: "Missing project." };
  }
  if (!Number.isFinite(input.startSec) || !Number.isFinite(input.endSec)) {
    return { error: "Invalid cut range." };
  }
  if (input.endSec - input.startSec > WAN_VIDEO_EDIT_INPUT_MAX_SEC + 0.05) {
    return {
      error: `Cut is too long (max ${WAN_VIDEO_EDIT_INPUT_MAX_SEC}s).`,
    };
  }

  const project = await prisma.videoFrameProject.findUnique({
    where: { id: projectId },
    select: { id: true, videoPath: true },
  });
  if (!project?.videoPath) {
    return { error: "Project source video not found." };
  }

  const absolute = absoluteFromPublicUpload(project.videoPath);
  if (!absolute) {
    return { error: "Project video path is invalid." };
  }

  try {
    const cut = await cutVideoSegment({
      absoluteSourcePath: absolute,
      startSec: input.startSec,
      endSec: input.endSec,
    });

    const cutsDir = path.join(videoFrameProjectDir(projectId), "cuts");
    await mkdir(cutsDir, { recursive: true });
    const startKey = input.startSec.toFixed(1).replace(".", "s");
    const endKey = input.endSec.toFixed(1).replace(".", "s");
    const fileName = `preview-${startKey}-${endKey}.mp4`;
    await writeFile(path.join(cutsDir, fileName), cut.bytes);

    const publicPath = publicVideoFramePath(projectId, `cuts/${fileName}`);
    // Cache-bust so re-renders after re-cut show the new file.
    return {
      path: `${publicPath}?t=${Date.now()}`,
      bytes: cut.bytes.byteLength,
      startSec: input.startSec,
      endSec: input.endSec,
    };
  } catch (error) {
    if (error instanceof VideoCutError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to cut span preview." };
  }
}
