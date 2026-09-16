import { readFile, access, stat } from "node:fs/promises";
import path from "node:path";

import { legacyPublicProductUploadsDir, productUploadsDir } from "@/lib/product-upload-paths";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

function safeFileName(raw: string): string | null {
  const name = raw.trim();
  if (!name || name !== path.basename(name) || name.includes("..") || name.includes("\\")) {
    return null;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    return null;
  }
  return name;
}

async function resolveExistingFile(fileName: string): Promise<string | null> {
  const candidates = [path.join(productUploadsDir(), fileName), path.join(legacyPublicProductUploadsDir(), fileName)];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      const info = await stat(candidate);
      if (info.isFile()) {
        return candidate;
      }
    } catch {
      // try next
    }
  }
  return null;
}

interface RouteContext {
  params: Promise<{ file: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { file: rawFile } = await context.params;
  const fileName = safeFileName(rawFile);
  if (!fileName) {
    return new Response("Not found", { status: 404 });
  }

  const absolutePath = await resolveExistingFile(fileName);
  if (!absolutePath) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const bytes = await readFile(absolutePath);

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
