"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";

import { searchEventsForResultCount, track } from "@/lib/analytics";

interface SearchTrackingProps {
  query: string;
  resultCount: number;
}

export function SearchTracking({ query, resultCount }: SearchTrackingProps) {
  const sent = useRef(false);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized || sent.current) return;
    sent.current = true;
    track({
      events: searchEventsForResultCount(resultCount),
      search: normalized,
      resultCount,
      path: "/products",
    });
  }, [query, resultCount]);

  return null;
}

export function SearchResultLink({
  href,
  productId,
  searchQuery,
  className,
  children,
}: {
  href: string;
  productId: string;
  searchQuery: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        track({
          events: ["search_result_click"],
          productId,
          search: searchQuery,
          path: href,
        });
      }}
    >
      {children}
    </Link>
  );
}
