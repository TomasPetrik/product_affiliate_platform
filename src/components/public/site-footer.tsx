import Link from "next/link";

import { Container } from "@/components/public/container";
import { SiteLogo } from "@/components/public/site-logo";
import { PRODUCT_COLLECTIONS } from "@/lib/collections";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/brand";

const FOOTER_LINK_GROUPS = [
  {
    title: "Discover",
    links: [
      { href: "/products", label: "All products" },
      { href: "/categories", label: "Categories" },
      { href: PRODUCT_COLLECTIONS.trending.href, label: PRODUCT_COLLECTIONS.trending.shortTitle },
      { href: PRODUCT_COLLECTIONS.featured.href, label: PRODUCT_COLLECTIONS.featured.shortTitle },
    ],
  },
  {
    title: "Collections",
    links: [
      { href: PRODUCT_COLLECTIONS.bestsellers.href, label: PRODUCT_COLLECTIONS.bestsellers.title },
      { href: PRODUCT_COLLECTIONS.newest.href, label: PRODUCT_COLLECTIONS.newest.title },
      { href: PRODUCT_COLLECTIONS.under50.href, label: PRODUCT_COLLECTIONS.under50.shortTitle },
      { href: PRODUCT_COLLECTIONS.under100.href, label: PRODUCT_COLLECTIONS.under100.shortTitle },
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
    <footer className="mt-auto border-t border-border bg-card">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div>
            <SiteLogo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{SITE_DESCRIPTION}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {SITE_NAME} does not sell products or process payments. Every purchase happens on the
              retailer&apos;s site.
            </p>
          </div>

          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
              <ul className="mt-3 space-y-2.5">
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

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE_NAME}. As an Amazon Associate and eBay Partner Network member, we earn from
            qualifying purchases.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link href="/disclosure" className="underline-offset-2 hover:text-foreground hover:underline">
              Affiliate disclosure
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
