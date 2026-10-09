import type { Metadata } from "next";
import Link from "next/link";

import { KreaVideoPanel } from "@/components/admin/krea-video-panel";
import { isKreaConfigured } from "@/server/services/krea.client";

export const metadata: Metadata = { title: "Krea video" };

export default function AdminKreaVideoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Krea video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate videos with Krea (Seedance, Kling, Hailuo, Veo) from a prompt and optional
          start/end/reference stills. Pull frames from{" "}
          <Link href="/admin/tools/video-frames" className="underline underline-offset-2">
            Video frames
          </Link>{" "}
          or upload images directly.
        </p>
      </div>
      <KreaVideoPanel configured={isKreaConfigured()} />
    </div>
  );
}
