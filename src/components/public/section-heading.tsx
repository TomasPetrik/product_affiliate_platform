import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  description?: string;
  eyebrow?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  id?: string;
}

/** Reusable "Title + optional 'see all' link" header used above product rails/grids. */
export function SectionHeading({
  title,
  description,
  eyebrow,
  viewAllHref,
  viewAllLabel = "View all",
  id,
}: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className={cn("text-section", eyebrow && "mt-2")}>
          {title}
        </h2>
        {description ? (
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            {description}
          </p>
        ) : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="mb-0.5 hidden shrink-0 items-center gap-1 text-sm font-semibold text-foreground/70 transition-colors duration-200 hover:text-foreground sm:inline-flex"
        >
          {viewAllLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
