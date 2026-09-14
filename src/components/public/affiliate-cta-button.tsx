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
 * `href` is the local `/go/[productSlug]` recorder, which then 302s to the
 * marketplace URL. `rel="sponsored nofollow"` stays on this element.
 */
export function AffiliateCtaButton({ link, className, variant = "default" }: AffiliateCtaButtonProps) {
  return (
    <Button
      render={<a href={link.href} target="_blank" rel="sponsored nofollow noopener" />}
      nativeButton={false}
      variant={variant}
      size="cta"
      className={cn("w-full sm:w-auto", className)}
    >
      Check price on {link.label}
      <ExternalLink className="size-4" aria-hidden="true" />
    </Button>
  );
}
