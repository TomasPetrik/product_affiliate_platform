import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { outboundHref } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface OutboundLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  href: string;
  children: ReactNode;
}

/**
 * External (non-affiliate) link. Clicks hop through `/go` so the
 * `outbound_click` event is recorded server-side before the browser leaves.
 */
export function OutboundLink({ href, children, className, rel, ...props }: OutboundLinkProps) {
  return (
    <a
      href={outboundHref(href)}
      rel={rel ?? "noopener noreferrer nofollow"}
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
}
