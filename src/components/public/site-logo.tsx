import Image from "next/image";
import Link from "next/link";

import { SITE_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const BRAND_MARK_SRC = "/brand/radarcut-mark.png";

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
      <RadarMark className={cn("size-7 shrink-0", markClassName)} />
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
    <Image
      src={BRAND_MARK_SRC}
      alt=""
      aria-hidden
      width={32}
      height={32}
      className={cn("object-contain", className)}
      unoptimized
    />
  );
}
