"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { formatWanCostUsd } from "@/lib/wan-cost";
import { cn } from "@/lib/utils";
import {
  estimateWanGenerationCostAction,
  type EstimateWanGenerationCostInput,
} from "@/server/actions/wan-cost.actions";

const ESTIMATE_DEBOUNCE_MS = 450;

interface WanCostEstimateProps {
  /** When false, clears the estimate and skips fetching. */
  enabled?: boolean;
  input: EstimateWanGenerationCostInput;
  className?: string;
  /** Compact label next to the Run button. */
  compact?: boolean;
}

/**
 * Debounced WaveSpeed price quote for the current form setup.
 * Re-fetches when duration / resolution / size / toggles change.
 */
export function WanCostEstimate({
  enabled = true,
  input,
  className,
  compact = false,
}: WanCostEstimateProps) {
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [listPriceUsd, setListPriceUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signature = JSON.stringify({
    kind: input.kind,
    size: input.size ?? null,
    duration: input.duration ?? null,
    resolution: input.resolution ?? null,
    aspectRatio: input.aspectRatio ?? null,
    generateAudio: input.generateAudio ?? null,
    enablePromptExpansion: input.enablePromptExpansion ?? null,
  });

  useEffect(() => {
    if (!enabled) {
      setCostUsd(null);
      setListPriceUsd(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void estimateWanGenerationCostAction(input).then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result.error || result.costUsd == null) {
          setCostUsd(null);
          setListPriceUsd(null);
          setError(result.error ?? "Estimate unavailable");
          return;
        }
        setCostUsd(result.costUsd);
        setListPriceUsd(result.listPriceUsd ?? null);
        setError(null);
      });
    }, ESTIMATE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // signature captures all pricing-relevant fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature]);

  if (!enabled) return null;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        {loading ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Estimating…
          </>
        ) : costUsd != null ? (
          <span className="tabular-nums font-medium text-foreground">
            Est. {formatWanCostUsd(costUsd)}
          </span>
        ) : error ? (
          <span title={error}>Est. —</span>
        ) : null}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span>Estimated cost</span>
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" />
            Calculating…
          </span>
        ) : costUsd != null ? (
          <span className="tabular-nums font-semibold text-foreground">
            {formatWanCostUsd(costUsd)}
          </span>
        ) : (
          <span>{error ?? "—"}</span>
        )}
      </div>
      {costUsd != null &&
      listPriceUsd != null &&
      listPriceUsd > costUsd + 0.0001 ? (
        <p className="mt-0.5 text-[11px]">
          List {formatWanCostUsd(listPriceUsd)} · your account rate applied
        </p>
      ) : (
        <p className="mt-0.5 text-[11px]">
          Based on current settings · final charge is set when WaveSpeed accepts
          the job
        </p>
      )}
    </div>
  );
}
