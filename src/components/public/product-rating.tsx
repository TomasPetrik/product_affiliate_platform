import { Star } from "lucide-react";

import { formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProductRatingProps {
  rating: number;
  count: number;
  className?: string;
}

export function ProductRating({ rating, count, className }: ProductRatingProps) {
  if (!rating) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm", className)}>
      <Star className="size-3.5 fill-foreground/70 text-foreground/70" aria-hidden="true" />
      <span className="font-medium text-foreground">{formatRating(rating)}</span>
      {count > 0 ? <span>({count.toLocaleString()})</span> : null}
      <span className="sr-only">
        Rated {formatRating(rating)} out of 5{count > 0 ? ` from ${count.toLocaleString()} ratings` : ""}
      </span>
    </div>
  );
}
