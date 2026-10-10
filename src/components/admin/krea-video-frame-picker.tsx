"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Film, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatVideoTime } from "@/lib/video-frames";
import {
  listKreaFrameProjectsAction,
  listKreaFramesForProjectAction,
  type KreaFrameOption,
  type KreaFrameProjectOption,
} from "@/server/actions/krea-video.actions";

export interface PickedKreaFrame {
  assetId: string;
  previewPath: string;
  fileName: string;
  timeSec: number;
  projectName?: string;
}

interface KreaVideoFramePickerProps {
  label: string;
  hint?: string;
  value: PickedKreaFrame | null;
  onChange: (frame: PickedKreaFrame | null) => void;
  disabled?: boolean;
  /** When true, picker allows multi-select and calls onAdd instead of replacing. */
  multi?: boolean;
  onAdd?: (frame: PickedKreaFrame) => void;
  excludeIds?: string[];
}

export function KreaVideoFramePicker({
  label,
  hint,
  value,
  onChange,
  disabled = false,
  multi = false,
  onAdd,
  excludeIds = [],
}: KreaVideoFramePickerProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<KreaFrameProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [frames, setFrames] = useState<KreaFrameOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProjects(true);
    setError(null);
    void listKreaFrameProjectsAction()
      .then((result) => {
        if (cancelled) return;
        setProjects(result.projects);
        if (result.error) setError(result.error);
        if (!projectId && result.projects[0]) {
          setProjectId(result.projects[0].id);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only load when dialog opens
  }, [open]);

  useEffect(() => {
    if (!open || !projectId) {
      setFrames([]);
      return;
    }
    let cancelled = false;
    setLoadingFrames(true);
    setError(null);
    void listKreaFramesForProjectAction(projectId)
      .then((result) => {
        if (cancelled) return;
        setFrames(result.frames);
        if (result.error) setError(result.error);
      })
      .finally(() => {
        if (!cancelled) setLoadingFrames(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  function pickFrame(frame: KreaFrameOption) {
    const project = projects.find((p) => p.id === projectId);
    const picked: PickedKreaFrame = {
      assetId: frame.id,
      previewPath: frame.thumbPath ?? frame.path,
      fileName: frame.fileName,
      timeSec: frame.timeSec,
      projectName: project?.name,
    };
    if (multi && onAdd) {
      onAdd(picked);
    } else {
      onChange(picked);
      setOpen(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      {value && !multi ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewPath}
            alt=""
            className="size-14 rounded-lg object-cover ring-1 ring-border"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {value.projectName ? `${value.projectName} · ` : ""}
              {formatVideoTime(value.timeSec)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear frame"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-fit"
      >
        <Film className="size-3.5" />
        {multi ? "Add from Video creator" : value ? "Change from Video creator" : "Pick from Video creator"}
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-lg outline-none sm:inset-x-auto">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold">
                  {label}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  Choose a still from a Video creator project.
                </Dialog.Description>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="krea-frame-project">Project</Label>
                {loadingProjects ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading projects…
                  </p>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Video creator projects yet. Extract frames first under Tools → Video creator.
                  </p>
                ) : (
                  <select
                    id="krea-frame-project"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.frameCount} frames)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              {loadingFrames ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading frames…
                </p>
              ) : frames.length === 0 && selectedProject ? (
                <p className="text-sm text-muted-foreground">
                  This project has no saved frames yet.
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {frames.map((frame) => {
                    const excluded = excludeIds.includes(frame.id);
                    return (
                      <li key={frame.id}>
                        <button
                          type="button"
                          disabled={excluded}
                          onClick={() => pickFrame(frame)}
                          className={cn(
                            "group flex w-full flex-col overflow-hidden rounded-lg ring-1 ring-border transition hover:ring-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={frame.thumbPath ?? frame.path}
                            alt=""
                            className="aspect-[9/16] w-full object-cover bg-muted"
                          />
                          <span className="truncate px-1.5 py-1 text-[10px] text-muted-foreground tabular-nums">
                            {formatVideoTime(frame.timeSec)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
