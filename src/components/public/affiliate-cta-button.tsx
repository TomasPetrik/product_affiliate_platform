import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketplaceLink } from "@/types/catalog";

interface AffiliateCtaButtonProps {
  link: MarketplaceLink;
  className?: string;
  variant?: "default" | "outline";
}

/**
 * Outbound affiliate CTA. This is the single point in the app that should
 * ever render a link to a marketplace, so compliance-required link
 * attributes (`sponsored nofollow`) live here once, not scattered per page.
 *
 * `href` is a placeholder marketplace homepage in this phase — real
 * per-product affiliate URLs (with tracking tags) and outbound-click
 * analytics events are wired up in later phases.
 */
export function AffiliateCtaButton({ link, className, variant = "default" }: AffiliateCtaButtonProps) {
  return (
    <Button
      render={<a href={link.href} target="_blank" rel="sponsored nofollow noopener" />}
      nativeButton={false}
      variant={variant}
      className={cn("gap-2", className)}
    >
      View on {link.label}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
