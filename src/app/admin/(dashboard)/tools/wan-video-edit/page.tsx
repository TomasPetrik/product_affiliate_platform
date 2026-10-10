import type { Metadata } from "next";
import Link from "next/link";

import { WanVideoEditPanel } from "@/components/admin/wan-video-edit-panel";
import { isWaveSpeedConfigured } from "@/server/services/wavespeed.client";

export const metadata: Metadata = { title: "Wan video edit" };

export default function AdminWanVideoEditPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wan video edit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit an existing clip with Alibaba Wan 3.0 video-edit via WaveSpeed (same{" "}
          <code className="text-xs">WAVESPEED_API_KEY</code> as{" "}
          <Link href="/admin/tools/wan-video" className="underline underline-offset-2">
            Wan video reference
          </Link>
          ). From{" "}
          <Link href="/admin/tools/video-frames" className="underline underline-offset-2">
            Video creator
          </Link>
          , each span can cut first→last frame and run this model.
        </p>
      </div>
      <WanVideoEditPanel configured={isWaveSpeedConfigured()} />
    </div>
  );
}
