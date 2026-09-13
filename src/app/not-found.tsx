import Link from "next/link";
import { Compass, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/public/search-bar";

/**
 * Global 404. Applies to any unmatched route (public or admin) that isn't
 * caught by a more specific `not-found.tsx` boundary.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>FindIt</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">404 — Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, may have moved, or the product may
          have been unpublished.
        </p>

        <div className="mt-6 w-full max-w-sm">
          <SearchBar />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/" />}>
            Back to homepage
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
            Browse products
          </Button>
        </div>
      </main>
    </div>
  );
}
