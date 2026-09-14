import Link from "next/link";

import { SITE_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface SiteLogoProps {
  className?: string;
  markClassName?: string;
  compact?: boolean;
}

export function SiteLogo({ className, markClassName, compact = false }: SiteLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 text-foreground transition-opacity hover:opacity-80",
        className,
      )}
      aria-label={`${SITE_NAME} home`}
    >
      <RadarMark className={cn("size-7 shrink-0 text-foreground", markClassName)} />
      {compact ? (
        <span className="sr-only">{SITE_NAME}</span>
      ) : (
        <span className="font-heading text-[1.05rem] font-extrabold tracking-tight">{SITE_NAME}</span>
      )}
    </Link>
  );
}

export function RadarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="16" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      <path d="M16 16L25.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
