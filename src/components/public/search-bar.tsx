import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  defaultValue?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Plain GET form to `/products` — works without client-side JavaScript and
 * keeps the query in the URL (`?q=`), which is what the listing page reads
 * to filter results server-side.
 */
export function SearchBar({ defaultValue, className, compact = false }: SearchBarProps) {
  return (
    <form action="/products" method="get" className={cn("flex w-full items-center gap-2", className)} role="search">
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search products"
          defaultValue={defaultValue}
          className={cn("border-border bg-card pl-9", compact ? "h-10 rounded-lg" : "h-11 rounded-lg")}
          aria-label="Search products"
        />
      </div>
      {compact ? (
        <Button type="submit" size="icon" variant="outline" className="size-10 shrink-0" aria-label="Search">
          <Search className="size-4" />
        </Button>
      ) : (
        <Button type="submit" size="cta" variant="secondary" className="h-11 shrink-0 px-4">
          Search
        </Button>
      )}
    </form>
  );
}
