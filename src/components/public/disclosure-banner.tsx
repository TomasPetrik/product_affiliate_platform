import Link from "next/link";

import { Container } from "@/components/public/container";
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
    <div className={cn("w-full border-b border-border bg-muted/70", className)}>
      <Container>
        <p className="py-2 text-center text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          We participate in the Amazon Associates and eBay Partner Network affiliate programs. As an
          affiliate, we earn from qualifying purchases at no extra cost to you.{" "}
          <Link href="/disclosure" className="font-medium underline underline-offset-2 hover:text-foreground">
            Learn more
          </Link>
          .
        </p>
      </Container>
    </div>
  );
}
