import { DollarSign, HardDrive } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWanCostUsd } from "@/lib/wan-cost";
import { formatByteSize } from "@/lib/video-frame-project-paths";

interface VideoFrameProjectSizeCardProps {
  videoBytes: number;
  framesBytes: number;
  thumbnailsBytes: number;
  editedBytes: number;
  clipsBytes: number;
  totalBytes: number;
  frameCount: number;
  thumbnailCount: number;
  editedCount: number;
  clipCount: number;
  /** Sum of WaveSpeed costs for Wan edits + clips (USD). */
  wanCostUsd?: number;
}

export function VideoFrameProjectSizeCard({
  videoBytes,
  framesBytes,
  thumbnailsBytes,
  editedBytes,
  clipsBytes,
  totalBytes,
  frameCount,
  thumbnailCount,
  editedCount,
  clipCount,
  wanCostUsd = 0,
}: VideoFrameProjectSizeCardProps) {
  const rows = [
    { label: "Original video", value: formatByteSize(videoBytes) },
    {
      label: `Extracted frames (${frameCount})`,
      value: formatByteSize(framesBytes),
    },
    {
      label: `Thumbnails (${thumbnailCount})`,
      value: formatByteSize(thumbnailsBytes),
    },
    {
      label: `Wan edits (${editedCount})`,
      value: formatByteSize(editedBytes),
    },
    {
      label: `Generated clips (${clipCount})`,
      value: formatByteSize(clipsBytes),
    },
    { label: "Total project size", value: formatByteSize(totalBytes), emphasize: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-4 w-4" />
          Storage
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg border border-border bg-muted/20 px-3 py-2"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd
                className={
                  row.emphasize ? "mt-0.5 text-sm font-semibold" : "mt-0.5 text-sm font-medium"
                }
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="size-3.5" />
            Wan generation cost
          </div>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatWanCostUsd(wanCostUsd)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sum of WaveSpeed charges for Wan image edits and generated clips saved
            on this project.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
