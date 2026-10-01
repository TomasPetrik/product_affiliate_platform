"use client";

import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORMS } from "@/lib/social-external-id";
import type {
  MarketingVideoSyncSummary,
  MarketingVideoViewDelta,
} from "@/server/services/marketing-video-sync.service";

function formatDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return value.toLocaleString();
  return "0";
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function deltaClassName(delta: number): string {
  if (delta > 0) return "font-medium text-emerald-700 dark:text-emerald-400";
  if (delta < 0) return "font-medium text-destructive";
  return "text-muted-foreground";
}

function DeltaValue({ delta }: { delta: number }) {
  return <span className={`tabular-nums ${deltaClassName(delta)}`}>{formatDelta(delta)}</span>;
}

function PlatformCountRows({
  byPlatform,
}: {
  byPlatform: Record<string, MarketingVideoViewDelta>;
}) {
  const platforms = SOCIAL_PLATFORMS.filter((platform) => {
    const row = byPlatform[platform];
    return row && (row.previous > 0 || row.current > 0 || row.delta !== 0);
  });

  if (platforms.length === 0) return null;

  return (
    <ul className="grid gap-1">
      {platforms.map((platform) => {
        const row = byPlatform[platform];
        return (
          <li key={platform} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{SOCIAL_PLATFORM_LABELS[platform]}</span>
            <span className="tabular-nums">
              <DeltaValue delta={row.delta} />
              <span className="ml-1.5 text-muted-foreground">
                ({formatCount(row.previous)} → {formatCount(row.current)})
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface MarketingVideoSyncResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: MarketingVideoSyncSummary | null;
  message?: string;
}

export function MarketingVideoSyncResultsDialog({
  open,
  onOpenChange,
  summary,
  message,
}: MarketingVideoSyncResultsDialogProps) {
  if (!summary) return null;

  const platformsWithActivity = SOCIAL_PLATFORMS.filter((platform) => {
    const row = summary.views.byPlatform[platform];
    return row.previous > 0 || row.current > 0 || row.delta !== 0;
  });

  const topProducts = summary.views.byProduct
    .filter((row) => row.delta !== 0)
    .slice(0, 8);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-lg data-[size=default]:max-w-lg data-[size=default]:sm:max-w-lg"
        size="default"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Video views refreshed</AlertDialogTitle>
          <AlertDialogDescription>
            {message ??
              `Synced ${summary.synced}/${summary.total} posts. Changes are vs the previous stored count.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 text-sm">
          <div className="rounded-lg border bg-muted/40 px-3 py-3">
            <p className="text-xs text-muted-foreground">Total video views</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {formatDelta(summary.views.total.delta)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatCount(summary.views.total.previous)} → {formatCount(summary.views.total.current)}
            </p>
          </div>

          {platformsWithActivity.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">By platform</p>
              <ul className="grid gap-1.5">
                {platformsWithActivity.map((platform) => {
                  const row = summary.views.byPlatform[platform];
                  return (
                    <li
                      key={platform}
                      className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-2"
                    >
                      <span>{SOCIAL_PLATFORM_LABELS[platform]}</span>
                      <span className="tabular-nums">
                        <DeltaValue delta={row.delta} />
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({formatCount(row.current)})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {topProducts.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">Products with changes</p>
              <ul className="grid max-h-72 gap-2 overflow-y-auto pr-0.5">
                {topProducts.map((row) => (
                  <li key={row.productId} className="grid gap-2 rounded-md border px-2.5 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium leading-snug">{row.title}</p>
                      <DeltaValue delta={row.delta} />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCount(row.previous)} → {formatCount(row.current)}
                    </p>
                    <PlatformCountRows byPlatform={row.byPlatform} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No view count changes since the previous sync.
            </p>
          )}

          {summary.failed > 0 || summary.skipped > 0 ? (
            <p className="text-xs text-muted-foreground">
              {summary.failed} failed, {summary.skipped} skipped.
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Opens the results dialog whenever a successful sync summary arrives. */
export function useMarketingVideoSyncResultsDialog(
  syncSummary: MarketingVideoSyncSummary | undefined,
  ok: boolean | undefined,
) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<MarketingVideoSyncSummary | null>(null);

  useEffect(() => {
    if (ok && syncSummary) {
      setSummary(syncSummary);
      setOpen(true);
    }
  }, [ok, syncSummary]);

  return { open, setOpen, summary };
}
