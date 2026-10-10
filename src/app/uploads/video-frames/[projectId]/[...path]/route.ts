import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { videoFrameProjectDir } from "@/lib/video-frame-project-paths";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

function safeProjectId(raw: string): string | null {
  const id = raw.trim();
  if (!id || id !== path.basename(id) || id.includes("..")) {
    return null;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return null;
  }
  return id;
}

function safeRelativePath(parts: string[]): string | null {
  if (parts.length === 0 || parts.length > 4) {
    return null;
  }
  for (const part of parts) {
    if (!part || part !== path.basename(part) || part.includes("..") || part.includes("\\")) {
      return null;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(part)) {
      return null;
    }
  }
  return parts.join("/");
}

interface RouteContext {
  params: Promise<{ projectId: string; path: string[] }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { projectId: rawProjectId, path: pathParts } = await context.params;
  const projectId = safeProjectId(rawProjectId);
  const relative = safeRelativePath(pathParts ?? []);
  if (!projectId || !relative) {
    return new Response("Not found", { status: 404 });
  }

  // Literal prefix keeps Turbopack NFT tracing scoped to this upload root.
  const absolutePath = path.join(
    process.cwd(),
    "storage",
    "uploads",
    "video-frames",
    projectId,
    relative,
  );
  const root = videoFrameProjectDir(projectId);
  if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await access(/* turbopackIgnore: true */ absolutePath);
    const info = await stat(/* turbopackIgnore: true */ absolutePath);
    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const bytes = await readFile(/* turbopackIgnore: true */ absolutePath);

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
