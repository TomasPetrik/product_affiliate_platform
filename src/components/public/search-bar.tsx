import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  defaultValue?: string;
  className?: string;
}

/**
 * Plain GET form to `/products` — works without client-side JavaScript and
 * keeps the query in the URL (`?q=`), which is what the listing page reads
 * to filter results server-side.
 */
export function SearchBar({ defaultValue, className }: SearchBarProps) {
  return (
    <form action="/products" method="get" className={cn("flex w-full items-center gap-2", className)}>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search products…"
          defaultValue={defaultValue}
          className="pl-8"
          aria-label="Search products"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" className="shrink-0">
        Search
      </Button>
    </form>
  );
}
