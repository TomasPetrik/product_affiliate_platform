"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import {
  processPriceSyncBatchAction,
  startManualPriceSyncAction,
} from "@/server/actions/price-sync.actions";
import type { PriceSyncRunSummary } from "@/server/services/price-sync.service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PriceSyncControlsProps {
  initialActiveRun: PriceSyncRunSummary | null;
}

export function PriceSyncControls({ initialActiveRun }: PriceSyncControlsProps) {
  const router = useRouter();
  const [run, setRun] = useState<PriceSyncRunSummary | null>(initialActiveRun);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRunId = run?.isActive ? run.id : null;

  useEffect(() => {
    if (!activeRunId) return;

    let cancelled = false;

    async function drain() {
      let currentId = activeRunId;
      let current: PriceSyncRunSummary | null = run;

      while (currentId && !cancelled) {
        const result = await processPriceSyncBatchAction(currentId);
        if (cancelled) break;
        if (!result.ok) {
          setError(result.error);
          break;
        }
        setRun(result.run);
        current = result.run;
        currentId = result.run.isActive ? result.run.id : null;
      }

      if (!cancelled && current && !current.isActive) {
        router.refresh();
      }
    }

    void drain();
    return () => {
      cancelled = true;
    };
    // Only restart when a new active run id appears — not on every progress tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [activeRunId, router]);

  function onStart() {
    setError(null);
    startTransition(async () => {
      const result = await startManualPriceSyncAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRun(result.run);
    });
  }

  const busy = isPending || Boolean(run?.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Manual sync</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pull the latest eBay prices for every active offer. Progress updates as each batch finishes.
          </p>
        </div>
        <Button type="button" onClick={onStart} disabled={busy} className="gap-1.5">
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
          {busy ? "Syncing…" : "Sync prices now"}
        </Button>
      </div>

      {run ? (
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">
              {run.isActive ? "In progress" : run.status === "COMPLETED" ? "Completed" : run.status}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {run.processedOffers}/{run.totalOffers} offers · {run.percentComplete}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${run.percentComplete}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {run.changedOffers} price update{run.changedOffers === 1 ? "" : "s"}
            {run.failedOffers > 0 ? ` · ${run.failedOffers} failed` : ""}
            {run.unchangedOffers > 0 ? ` · ${run.unchangedOffers} unchanged` : ""}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
