import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketplaceLink } from "@/types/catalog";

interface AffiliateCtaButtonProps {
  link: MarketplaceLink;
  className?: string;
  variant?: "default" | "outline";
  label?: string;
}

/**
 * Outbound affiliate CTA. This is the single point in the app that should
 * ever render a link to a marketplace, so compliance-required link
 * attributes (`sponsored nofollow`) live here once, not scattered per page.
 *
 * `href` is the local `/go/[productSlug]` recorder, which then 302s to the
 * stored affiliate URL. The button label always names the retailer.
 */
export function AffiliateCtaButton({
  link,
  className,
  variant = "default",
  label,
}: AffiliateCtaButtonProps) {
  return (
    <Button
      render={<a href={link.href} target="_blank" rel="sponsored nofollow noopener" />}
      nativeButton={false}
      variant={variant}
      size="cta"
      className={cn("w-full sm:w-auto", className)}
    >
      {label ?? `Check price on ${link.label}`}
      <ExternalLink className="size-4" aria-hidden="true" />
    </Button>
  );
}
