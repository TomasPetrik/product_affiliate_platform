import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { VideoFrameExtractPanel } from "@/components/admin/video-frame-extract-panel";
import { VideoFrameProjectDeleteButton } from "@/components/admin/video-frame-project-delete-button";
import { VideoFrameProjectSizeCard } from "@/components/admin/video-frame-project-size-card";
import { Button } from "@/components/ui/button";
import { getVideoFrameProject } from "@/server/services/video-frame-project.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getVideoFrameProject(id);
  return { title: project ? `${project.name} · Video frames` : "Video frames" };
}

export default async function AdminVideoFrameProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getVideoFrameProject(id);
  if (!project) {
    notFound();
  }

  const frameCount = project.assets.filter((asset) => asset.kind === "FRAME").length;
  const thumbnailCount = project.assets.filter((asset) => asset.kind === "THUMBNAIL").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 gap-1.5 px-0"
            nativeButton={false}
            render={<Link href="/admin/tools/video-frames" />}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </Button>
          <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spans and project name autosave. Extracted frames are stored with this project.
          </p>
        </div>
        <VideoFrameProjectDeleteButton projectId={project.id} projectName={project.name} />
      </div>

      <VideoFrameProjectSizeCard
        videoBytes={project.videoBytes}
        framesBytes={project.framesBytes}
        thumbnailsBytes={project.thumbnailsBytes}
        totalBytes={project.totalBytes}
        frameCount={frameCount}
        thumbnailCount={thumbnailCount}
      />

      <VideoFrameExtractPanel project={project} />
    </div>
  );
}
