"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, Pause, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatVideoTime } from "@/lib/video-frames";
import { cn } from "@/lib/utils";
import type { VideoFrameProjectAssetDto } from "@/server/services/video-frame-project.service";

export interface VideoFrameClipCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clip: VideoFrameProjectAssetDto | null;
  /** Full project source video — used as the “before” side when a span range exists. */
  sourceVideoUrl: string | null;
  compareStartSec?: number | null;
  compareEndSec?: number | null;
}

function clipProviderLabel(fileName: string): string {
  if (fileName.includes("-wan-edit-")) return "Wan edit";
  if (fileName.includes("-wan-")) return "Wan clip";
  if (fileName.includes("-krea-")) return "Krea";
  return "Generated";
}

export function VideoFrameClipCompareDialog({
  open,
  onOpenChange,
  clip,
  sourceVideoUrl,
  compareStartSec,
  compareEndSec,
}: VideoFrameClipCompareDialogProps) {
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const canCompare =
    clip != null &&
    clip.kind === "CLIP" &&
    Boolean(sourceVideoUrl) &&
    compareStartSec != null &&
    compareEndSec != null &&
    Number.isFinite(compareStartSec) &&
    Number.isFinite(compareEndSec) &&
    compareEndSec > compareStartSec;

  const startSec = canCompare ? (compareStartSec as number) : 0;
  const endSec = canCompare ? (compareEndSec as number) : 0;

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      return;
    }
    setPlaying(false);
    const before = beforeRef.current;
    const after = afterRef.current;
    before?.pause();
    after?.pause();
    if (before && canCompare) {
      const seek = () => {
        try {
          before.currentTime = startSec;
        } catch {
          // Ignore seek before metadata.
        }
      };
      if (before.readyState >= 1) seek();
      else before.addEventListener("loadedmetadata", seek, { once: true });
    }
    if (after) {
      try {
        after.currentTime = 0;
      } catch {
        // Ignore.
      }
    }
  }, [open, clip?.id, canCompare, startSec]);

  function pauseBoth() {
    beforeRef.current?.pause();
    afterRef.current?.pause();
    setPlaying(false);
  }

  async function playBoth() {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (canCompare && before) {
      if (before.currentTime < startSec || before.currentTime >= endSec - 0.04) {
        before.currentTime = startSec;
      }
    }
    if (after && after.ended) {
      after.currentTime = 0;
    }
    try {
      await Promise.all([
        before && canCompare ? before.play() : Promise.resolve(),
        after ? after.play() : Promise.resolve(),
      ]);
      setPlaying(true);
    } catch {
      pauseBoth();
    }
  }

  function togglePlay() {
    if (playing) pauseBoth();
    else void playBoth();
  }

  function onBeforeTimeUpdate() {
    const before = beforeRef.current;
    if (!before || !canCompare || !playing) return;
    if (before.currentTime >= endSec - 0.04) {
      before.pause();
      before.currentTime = endSec;
      // Keep after playing until it ends; if after already ended, stop.
      if (!afterRef.current || afterRef.current.paused || afterRef.current.ended) {
        setPlaying(false);
      }
    }
  }

  function onAfterEnded() {
    const before = beforeRef.current;
    if (before && !before.paused && canCompare && before.currentTime < endSec - 0.04) {
      return;
    }
    pauseBoth();
  }

  function onBeforeEnded() {
    if (!afterRef.current || afterRef.current.paused || afterRef.current.ended) {
      setPlaying(false);
    }
  }

  const title =
    clip?.kind === "MERGED" && clip.label
      ? `Version ${clip.label} · ${clip.fileName}`
      : (clip?.fileName ?? "Clip");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-3 top-[4vh] z-50 mx-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border bg-background shadow-lg outline-none",
            canCompare ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-medium">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {canCompare
                  ? `Compare original span (${formatVideoTime(startSec)} – ${formatVideoTime(endSec)}) with ${clipProviderLabel(clip!.fileName).toLowerCase()} output`
                  : clip?.kind === "MERGED"
                    ? "Merged video · open or download"
                    : "Generated clip · open or download"}
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-muted/40 p-4">
            {clip && canCompare ? (
              <>
                <div className="mx-auto flex w-full max-w-4xl items-start justify-center gap-3 sm:gap-5">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <p className="text-center text-xs font-medium text-muted-foreground">
                      Original
                    </p>
                    <div className="mx-auto aspect-[9/16] h-[min(68vh,36rem)] max-w-full overflow-hidden rounded-xl bg-black ring-1 ring-border">
                      <video
                        ref={beforeRef}
                        key={`before-${clip.id}-${startSec}-${endSec}`}
                        src={sourceVideoUrl!}
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-contain"
                        onTimeUpdate={onBeforeTimeUpdate}
                        onEnded={onBeforeEnded}
                      />
                    </div>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <p className="text-center text-xs font-medium text-muted-foreground">
                      Generated
                    </p>
                    <div className="mx-auto aspect-[9/16] h-[min(68vh,36rem)] max-w-full overflow-hidden rounded-xl bg-black ring-1 ring-border">
                      <video
                        ref={afterRef}
                        key={`after-${clip.id}`}
                        src={clip.path}
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-contain"
                        onEnded={onAfterEnded}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" variant="default" size="sm" onClick={togglePlay}>
                    {playing ? (
                      <>
                        <Pause className="size-3.5" />
                        Pause both
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        Play both
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      pauseBoth();
                      const before = beforeRef.current;
                      const after = afterRef.current;
                      if (before) before.currentTime = startSec;
                      if (after) after.currentTime = 0;
                    }}
                  >
                    Restart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    nativeButton={false}
                    render={
                      <a
                        href={clip.path}
                        download={clip.fileName}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <Download className="size-3.5" />
                    Download generated
                  </Button>
                </div>
              </>
            ) : clip ? (
              <div className="flex flex-col items-center gap-3">
                <div className="aspect-[9/16] max-h-[min(70vh,40rem)] w-full max-w-sm overflow-hidden rounded-xl bg-black ring-1 ring-border">
                  <video
                    key={clip.path}
                    src={clip.path}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  nativeButton={false}
                  render={
                    <a
                      href={clip.path}
                      download={clip.fileName}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
              </div>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
