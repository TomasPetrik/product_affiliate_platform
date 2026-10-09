"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Upload } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES } from "@/lib/video-frame-project-paths";
import {
  createVideoFrameProjectAction,
  type VideoFrameProjectActionState,
} from "@/server/actions/video-frame-project.actions";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v";

export function VideoFrameProjectCreateForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<VideoFrameProjectActionState, FormData>(
    createVideoFrameProjectAction,
    {},
  );

  useEffect(() => {
    if (state.ok && state.project?.id) {
      router.push(`/admin/tools/video-frames/${state.project.id}`);
    }
  }, [state, router]);

  const maxMb = Math.round(MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES / (1024 * 1024));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" />
          New project
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              name="name"
              placeholder="e.g. Spring launch cutdowns"
              maxLength={120}
              required
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-video">Source video</Label>
            <input
              ref={fileRef}
              id="project-video"
              name="video"
              type="file"
              accept={ACCEPT}
              required
              disabled={pending}
              className="sr-only"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <Upload className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {fileName ?? "Choose MP4, WebM, or MOV"}
                </span>
                <span className="block text-xs text-muted-foreground">{maxMb}MB max</span>
              </span>
            </button>
          </div>

          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={pending} className="w-fit gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {pending ? "Creating…" : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
