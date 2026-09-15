import Link from "next/link";

import { AFFILIATE_DISCLOSURE_SHORT } from "@/lib/affiliate-disclosure";

interface AffiliateDisclosureProps {
  className?: string;
}

export function AffiliateDisclosure({ className }: AffiliateDisclosureProps) {
  return (
    <p className={className}>
      {AFFILIATE_DISCLOSURE_SHORT}{" "}
      <Link href="/disclosure" className="font-medium underline underline-offset-2 hover:text-foreground">
        Affiliate disclosure
      </Link>
      .
    </p>
  );
}
