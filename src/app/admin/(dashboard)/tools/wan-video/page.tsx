import type { Metadata } from "next";
import Link from "next/link";

import { WanVideoPanel } from "@/components/admin/wan-video-panel";
import { isWaveSpeedConfigured } from "@/server/services/wavespeed.client";

export const metadata: Metadata = { title: "Wan video reference" };

export default function AdminWanVideoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wan video reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate videos with Alibaba Wan 3.0 reference-to-video via WaveSpeed (same{" "}
          <code className="text-xs">WAVESPEED_API_KEY</code> as{" "}
          <Link href="/admin/tools/wan-image-edit" className="underline underline-offset-2">
            Wan image edit
          </Link>
          ). Pull stills from{" "}
          <Link href="/admin/tools/video-frames" className="underline underline-offset-2">
            Video creator
          </Link>{" "}
          or upload references.
        </p>
      </div>
      <WanVideoPanel configured={isWaveSpeedConfigured()} />
    </div>
  );
}
