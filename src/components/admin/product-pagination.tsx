import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { productListHref, type ProductAdminQuery } from "@/lib/product-admin-query";

interface ProductPaginationProps {
  query: ProductAdminQuery;
  total: number;
  pageCount: number;
}

export function ProductPagination({ query, total, pageCount }: ProductPaginationProps) {
  if (total === 0) {
    return null;
  }

  const from = (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);
  const pages = visiblePages(query.page, pageCount);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          disabled={query.page <= 1}
          render={query.page <= 1 ? undefined : <Link href={productListHref(query, { page: query.page - 1 })} />}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        {pages.map((page, index) =>
          page === "…" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === query.page ? "default" : "outline"}
              size="icon-sm"
              nativeButton={false}
              render={<Link href={productListHref(query, { page })} />}
              aria-current={page === query.page ? "page" : undefined}
            >
              {page}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          disabled={query.page >= pageCount}
          render={query.page >= pageCount ? undefined : <Link href={productListHref(query, { page: query.page + 1 })} />}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function visiblePages(current: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];

  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      result.push("…");
    }
    result.push(page);
  }

  return result;
}
