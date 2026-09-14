import { Star } from "lucide-react";

import { formatCompactCount, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProductRatingProps {
  rating: number;
  count: number;
  className?: string;
  compact?: boolean;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, rating - index));

        return (
          <span key={index} className="relative size-3.5 shrink-0">
            <Star className="size-3.5 text-rating/35" strokeWidth={1.75} />
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="size-3.5 fill-rating text-rating" strokeWidth={1.75} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function ProductRating({ rating, count, className, compact = false }: ProductRatingProps) {
  if (!rating) {
    return null;
  }

  const countLabel =
    count > 0 ? `${formatCompactCount(count)} ${count === 1 ? "rating" : "ratings"}` : null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[13px] leading-none text-muted-foreground",
        className,
      )}
    >
      {compact ? (
        <Star className="size-3.5 fill-rating text-rating" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <StarRow rating={rating} />
      )}
      <span className="font-semibold text-foreground">{formatRating(rating)}</span>
      {countLabel ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{countLabel}</span>
        </>
      ) : null}
      <span className="sr-only">
        Rated {formatRating(rating)} out of 5{count > 0 ? ` from ${count.toLocaleString("en-US")} ratings` : ""}
      </span>
    </div>
  );
}
