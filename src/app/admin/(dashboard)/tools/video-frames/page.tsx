import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";

import { VideoFrameProjectCreateForm } from "@/components/admin/video-frame-project-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatByteSize } from "@/lib/video-frame-project-paths";
import { formatVideoTime } from "@/lib/video-frames";
import { listVideoFrameProjects } from "@/server/services/video-frame-project.service";

export const metadata: Metadata = { title: "Video creator" };
export const dynamic = "force-dynamic";

export default async function AdminVideoFramesPage() {
  const projects = await listVideoFrameProjects();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Video creator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each uploaded video becomes a named project with saved spans, extracted JPGs, and storage
          usage. Open a project anytime to continue editing — changes autosave.
        </p>
      </div>

      <VideoFrameProjectCreateForm />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" />
            Projects
            <Badge variant="secondary">{projects.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects yet. Create one above to upload a video and start defining spans.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Spans</TableHead>
                  <TableHead>Frames</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{project.name}</span>
                        {project.videoFileName ? (
                          <span className="text-xs text-muted-foreground">
                            {project.videoFileName}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {project.durationSec > 0 ? formatVideoTime(project.durationSec) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{project.spanCount}</TableCell>
                    <TableCell className="tabular-nums">{project.frameCount}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatByteSize(project.totalBytes)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.updatedAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/admin/tools/video-frames/${project.id}`} />}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
