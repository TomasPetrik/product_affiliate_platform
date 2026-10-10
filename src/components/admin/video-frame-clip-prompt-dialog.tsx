"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatWanCostUsd } from "@/lib/wan-cost";
import { formatVideoTime } from "@/lib/video-frames";
import { formatWanVideoEditHistoryTime } from "@/lib/wan-video-edit-history";

export type ClipPromptDetailsKind = "wan-edit" | "wan-clip";

export interface ClipPromptDetails {
  kind: ClipPromptDetailsKind;
  prompt: string;
  createdAt: string;
  duration: number | null;
  resolution: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  aspectRatio?: string;
  cutStartSec?: number;
  cutEndSec?: number;
  referenceImageCount: number;
  referenceAudioCount?: number;
  predictionId: string;
  status: string;
  sourceLabel?: string;
  inferenceMs?: number;
  costUsd?: number | null;
}

export interface VideoFrameClipPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipFileName: string | null;
  details: ClipPromptDetails | null;
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function VideoFrameClipPromptDialog({
  open,
  onOpenChange,
  clipFileName,
  details,
}: VideoFrameClipPromptDialogProps) {
  const title =
    details?.kind === "wan-clip"
      ? "Wan clip prompt"
      : details?.kind === "wan-edit"
        ? "Wan edit prompt"
        : "Clip prompt";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-x-4 top-[10vh] z-50 mx-auto flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-background shadow-lg outline-none">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="text-sm font-medium">{title}</Dialog.Title>
              <Dialog.Description className="truncate text-xs text-muted-foreground">
                {clipFileName ?? "From browser Wan history"}
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            {!details ? (
              <p className="text-sm text-muted-foreground">
                No matching Wan history entry in this browser. Prompt and
                parameters are only available for runs saved to history here.
              </p>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Prompt
                  </p>
                  <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                    {details.prompt.trim() || "—"}
                  </p>
                </div>

                <dl className="grid gap-2 rounded-lg border p-3">
                  <ParamRow
                    label="When"
                    value={formatWanVideoEditHistoryTime(details.createdAt)}
                  />
                  {details.sourceLabel ? (
                    <ParamRow label="Source" value={details.sourceLabel} />
                  ) : null}
                  <ParamRow label="Status" value={details.status} />
                  <ParamRow
                    label="Duration"
                    value={
                      details.duration == null
                        ? "auto"
                        : `${details.duration}s`
                    }
                  />
                  <ParamRow label="Resolution" value={details.resolution} />
                  {details.aspectRatio ? (
                    <ParamRow label="Aspect" value={details.aspectRatio} />
                  ) : null}
                  <ParamRow
                    label="Seed"
                    value={details.seed.trim() || "random"}
                  />
                  <ParamRow
                    label="Audio"
                    value={details.generateAudio ? "On" : "Off"}
                  />
                  <ParamRow
                    label="Prompt expand"
                    value={details.enablePromptExpansion ? "On" : "Off"}
                  />
                  {details.cutStartSec != null && details.cutEndSec != null ? (
                    <ParamRow
                      label="Cut"
                      value={`${formatVideoTime(details.cutStartSec)} – ${formatVideoTime(details.cutEndSec)}`}
                    />
                  ) : null}
                  <ParamRow
                    label="Ref images"
                    value={String(details.referenceImageCount)}
                  />
                  {details.referenceAudioCount != null ? (
                    <ParamRow
                      label="Ref audio"
                      value={String(details.referenceAudioCount)}
                    />
                  ) : null}
                  {details.inferenceMs != null ? (
                    <ParamRow
                      label="Inference"
                      value={`${(details.inferenceMs / 1000).toFixed(1)}s`}
                    />
                  ) : null}
                  {details.costUsd != null ? (
                    <ParamRow
                      label="Cost"
                      value={formatWanCostUsd(details.costUsd)}
                    />
                  ) : null}
                  {details.predictionId ? (
                    <ParamRow
                      label="Prediction"
                      value={details.predictionId}
                    />
                  ) : null}
                </dl>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
