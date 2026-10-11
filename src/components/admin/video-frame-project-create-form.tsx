"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Upload, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES,
} from "@/lib/video-frame-project-paths";
import { MAX_VIDEO_FRAME_PROJECT_VIDEOS } from "@/lib/video-frame-project-videos";
import {
  createVideoFrameProjectAction,
  type VideoFrameProjectActionState,
} from "@/server/actions/video-frame-project.actions";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v";

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

function hasFileDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  return Boolean(
    event.dataTransfer &&
      Array.from(event.dataTransfer.types).includes("Files"),
  );
}

export function VideoFrameProjectCreateForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dropOver, setDropOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
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
  const atLimit = files.length >= MAX_VIDEO_FRAME_PROJECT_VIDEOS;

  function addFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) {
      return;
    }
    const candidates = Array.from(list);
    const videos = candidates.filter(isVideoFile);
    if (videos.length === 0) {
      setDropError("Drop MP4, WebM, or MOV videos.");
      return;
    }
    setDropError(null);
    setFiles((prev) => {
      const next = [...prev];
      for (const file of videos) {
        if (next.length >= MAX_VIDEO_FRAME_PROJECT_VIDEOS) break;
        if (next.some((item) => item.name === file.name && item.size === file.size)) {
          continue;
        }
        next.push(file);
      }
      return next;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(formData: FormData) {
    for (const file of files) {
      formData.append("videos", file);
    }
    return formAction(formData);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" />
          New project
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="flex flex-col gap-4">
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
            <Label htmlFor="project-videos">Source videos</Label>
            <input
              ref={fileRef}
              id="project-videos"
              type="file"
              accept={ACCEPT}
              multiple
              disabled={pending || atLimit}
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />
            <div
              role="button"
              tabIndex={pending || atLimit ? -1 : 0}
              aria-disabled={pending || atLimit}
              onClick={() => {
                if (!pending && !atLimit) fileRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (pending || atLimit) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragEnter={(event) => {
                if (!hasFileDrag(event) || pending || atLimit) return;
                event.preventDefault();
                setDropOver(true);
              }}
              onDragOver={(event) => {
                if (!hasFileDrag(event) || pending || atLimit) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (!dropOver) setDropOver(true);
              }}
              onDragLeave={(event) => {
                if (
                  event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  return;
                }
                setDropOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropOver(false);
                if (pending || atLimit) return;
                addFiles(event.dataTransfer.files);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors",
                dropOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:bg-muted/50",
                (pending || atLimit) && "pointer-events-none opacity-60",
              )}
            >
              <Upload className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {dropOver
                    ? "Drop videos to add…"
                    : files.length === 0
                      ? "Drag & drop or choose MP4, WebM, or MOV files"
                      : `Add more videos (${files.length}/${MAX_VIDEO_FRAME_PROJECT_VIDEOS})`}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {maxMb}MB max each · pick which video to span from later
                </span>
              </span>
            </div>

            {files.length > 0 ? (
              <ul className="flex flex-col gap-1.5 pt-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeFile(index)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {dropError || state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{dropError ?? state.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={pending || files.length === 0}
            className="w-fit gap-1.5"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {pending ? "Creating…" : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
