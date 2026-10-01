"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankedRow } from "@/server/services/analytics.service";

interface RankedTableProps {
  rows: RankedRow[];
  emptyLabel: string;
  showClicks?: boolean;
  metricLabel?: string;
  /** Show marketing-video funnel columns (total + IG/FB/YT/TikTok). */
  showMarketingFunnel?: boolean;
  /** When set, show this many rows until Full view is clicked. */
  previewLimit?: number;
}

function formatCount(value: number | undefined): string {
  return (value ?? 0).toLocaleString();
}

export function RankedTable({
  rows,
  emptyLabel,
  showClicks = true,
  metricLabel = "Views",
  showMarketingFunnel = false,
  previewLimit,
}: RankedTableProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = previewLimit !== undefined && rows.length > previewLimit;
  const visibleRows = canExpand && !expanded ? rows.slice(0, previewLimit) : rows;

  const colCount =
    1 + // name
    (showMarketingFunnel ? 5 : 0) +
    1 + // metric
    (showClicks ? 1 : 0);

  return (
    <div className={showMarketingFunnel ? "overflow-x-auto" : undefined}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showMarketingFunnel ? (
              <>
                <TableHead className="text-right" title="Sum of Instagram + Facebook + YouTube + TikTok">
                  Video views
                </TableHead>
                <TableHead className="text-right">IG</TableHead>
                <TableHead className="text-right">FB</TableHead>
                <TableHead className="text-right">YT</TableHead>
                <TableHead className="text-right">TikTok</TableHead>
              </>
            ) : null}
            <TableHead className="text-right">{metricLabel}</TableHead>
            {showClicks ? <TableHead className="text-right">Clicks</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[14rem] font-medium sm:max-w-xs">
                {row.href ? (
                  <Link href={row.href} className="underline-offset-2 hover:underline">
                    {row.label}
                  </Link>
                ) : (
                  row.label
                )}
              </TableCell>
              {showMarketingFunnel ? (
                <>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCount(row.marketingViews)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCount(row.platformViews?.INSTAGRAM)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCount(row.platformViews?.FACEBOOK)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCount(row.platformViews?.YOUTUBE)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCount(row.platformViews?.TIKTOK)}
                  </TableCell>
                </>
              ) : null}
              <TableCell className="text-right tabular-nums">{row.views.toLocaleString()}</TableCell>
              {showClicks ? (
                <TableCell className="text-right tabular-nums">{row.clicks.toLocaleString()}</TableCell>
              ) : null}
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="py-10 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      {canExpand ? (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {expanded
              ? `Showing all ${rows.length.toLocaleString()} products`
              : `Showing top ${previewLimit} of ${rows.length.toLocaleString()}`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Full view
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
