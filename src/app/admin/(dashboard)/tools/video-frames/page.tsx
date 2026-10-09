import type { Metadata } from "next";

import { VideoFrameExtractPanel } from "@/components/admin/video-frame-extract-panel";

export const metadata: Metadata = { title: "Video frames" };

export default function AdminVideoFramesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Video frames</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a video, define time spans with how many frames each should yield, then export JPG
          stills. Extraction runs in your browser — nothing is uploaded to the server.
        </p>
      </div>
      <VideoFrameExtractPanel />
    </div>
  );
}
