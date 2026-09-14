import { ProductRating } from "@/components/public/product-rating";
import { cn } from "@/lib/utils";

interface RadarScoreProps {
  rating: number;
  count: number;
  /** RadarCut's own 0–10 score. Omit when the catalog does not provide one. */
  score?: number | null;
  className?: string;
}

/**
 * Visual foundation for RadarCut's own recommendation, kept distinct from
 * retailer/customer star ratings. Renders the score block only when `score`
 * is supplied so we never invent catalog data.
 */
export function RadarScore({ rating, count, score = null, className }: RadarScoreProps) {
  const hasScore = typeof score === "number" && Number.isFinite(score);

  if (!hasScore && !rating) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col gap-2 rounded-[16px] border border-border bg-rating-soft/70 px-4 py-3",
        className,
      )}
    >
      {hasScore ? (
        <div>
          <p className="text-eyebrow text-[0.65rem] tracking-[0.18em]">Radar Score</p>
          <p className="mt-1 font-heading text-[1.75rem] font-extrabold leading-none tracking-tight">
            {score.toFixed(1)}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">/ 10</span>
          </p>
        </div>
      ) : (
        <p className="text-eyebrow text-[0.65rem] tracking-[0.18em]">People love this</p>
      )}
      <ProductRating rating={rating} count={count} />
    </div>
  );
}
