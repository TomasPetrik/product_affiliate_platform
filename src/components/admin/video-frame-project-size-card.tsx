import { HardDrive } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatByteSize } from "@/lib/video-frame-project-paths";

interface VideoFrameProjectSizeCardProps {
  videoBytes: number;
  framesBytes: number;
  thumbnailsBytes: number;
  totalBytes: number;
  frameCount: number;
  thumbnailCount: number;
}

export function VideoFrameProjectSizeCard({
  videoBytes,
  framesBytes,
  thumbnailsBytes,
  totalBytes,
  frameCount,
  thumbnailCount,
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
      <CardContent>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      </CardContent>
    </Card>
  );
}
