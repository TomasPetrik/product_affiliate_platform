import Link from "next/link";
import { Compass } from "lucide-react";

import { SITE_NAME } from "@/lib/brand";

const FOOTER_LINK_GROUPS = [
  {
    title: "Browse",
    links: [
      { href: "/products", label: "All products" },
      { href: "/categories", label: "Categories" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/disclosure", label: "Affiliate disclosure" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>{SITE_NAME}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {SITE_NAME} helps you decide fast by curating and reviewing products from marketplaces like
              Amazon and eBay. We don&apos;t sell products or process payments — every purchase
              happens directly on the retailer&apos;s site.
            </p>
          </div>

          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE_NAME}. As an Amazon Associate and eBay Partner Network member, we earn from
            qualifying purchases.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link href="/disclosure" className="underline-offset-2 hover:text-foreground hover:underline">
              Affiliate disclosure
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
