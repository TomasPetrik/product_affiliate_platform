import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/public/search-bar";
import { SiteLogo } from "@/components/public/site-logo";

/**
 * Global 404. Applies to any unmatched route (public or admin) that isn't
 * caught by a more specific `not-found.tsx` boundary.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center px-4 sm:px-6">
          <SiteLogo />
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-page-title">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, may have moved, or the product may
          have been unpublished.
        </p>

        <div className="mt-8 w-full max-w-sm">
          <SearchBar />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/" />} size="cta">
            Back to homepage
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/products" />} size="cta">
            Browse products
          </Button>
        </div>
      </main>
    </div>
  );
}
