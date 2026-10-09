import type { Metadata } from "next";

import { WanImageEditPanel } from "@/components/admin/wan-image-edit-panel";
import { isWaveSpeedConfigured } from "@/server/services/wavespeed.client";

export const metadata: Metadata = { title: "Wan image edit" };

export default function AdminWanImageEditPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wan image edit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit a still (e.g. from Video frames) with Alibaba Wan 2.7 Image Edit Pro via
          WaveSpeed. Upload the main image, optional reference, set a prompt and 9:16 size,
          then poll until outputs are ready.
        </p>
      </div>
      <WanImageEditPanel configured={isWaveSpeedConfigured()} />
    </div>
  );
}
