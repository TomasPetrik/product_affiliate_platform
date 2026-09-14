import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/components/public/container";
import { SearchBar } from "@/components/public/search-bar";
import { SiteLogo } from "@/components/public/site-logo";
import { NAV_LINKS, PRODUCT_COLLECTIONS } from "@/lib/collections";
import { SITE_NAME } from "@/lib/brand";

const MOBILE_LINKS = [
  ...NAV_LINKS,
  { href: PRODUCT_COLLECTIONS.bestsellers.href, label: PRODUCT_COLLECTIONS.bestsellers.shortTitle },
  { href: PRODUCT_COLLECTIONS.newest.href, label: PRODUCT_COLLECTIONS.newest.shortTitle },
  { href: PRODUCT_COLLECTIONS.under50.href, label: PRODUCT_COLLECTIONS.under50.shortTitle },
  { href: PRODUCT_COLLECTIONS.under100.href, label: PRODUCT_COLLECTIONS.under100.shortTitle },
] as const;

/** Site-wide navigation, shared by every public page. Mobile-first: nav
 * links collapse into a slide-out sheet below the `md` breakpoint. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full min-w-0 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <Container className="flex h-16 items-center gap-6 lg:h-[4.25rem]">
        <SiteLogo />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/70 transition-colors duration-200 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block">
          <SearchBar compact />
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="ml-auto size-10 md:hidden" aria-label="Open menu" />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle className="font-heading text-base font-bold">{SITE_NAME}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-8">
              <SearchBar />
              <nav className="flex flex-col" aria-label="Mobile">
                {MOBILE_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    nativeButton={false}
                    render={
                      <Link
                        href={link.href}
                        className="rounded-lg px-2 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </Container>
    </header>
  );
}
