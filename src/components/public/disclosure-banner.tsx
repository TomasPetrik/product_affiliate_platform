import Link from "next/link";

import { cn } from "@/lib/utils";

interface DisclosureBannerProps {
  className?: string;
}

/**
 * FTC-required affiliate disclosure. Kept as a persistent, site-wide,
 * conspicuous element rather than something buried only on a policy page —
 * see the "Affiliate compliance" notes from the architecture proposal.
 */
export function DisclosureBanner({ className }: DisclosureBannerProps) {
  return (
    <div className={cn("w-full bg-muted/60 border-b text-center", className)}>
      <p className="mx-auto max-w-6xl px-4 py-2 text-xs text-muted-foreground">
        We participate in the Amazon Associates and eBay Partner Network affiliate programs. As an
        affiliate, we earn from qualifying purchases at no extra cost to you.{" "}
        <Link href="/disclosure" className="underline underline-offset-2 hover:text-foreground">
          Learn more
        </Link>
        .
      </p>
    </div>
  );
}
