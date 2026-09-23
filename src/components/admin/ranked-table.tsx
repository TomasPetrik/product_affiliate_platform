import Link from "next/link";

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
}: RankedTableProps) {
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
          {rows.map((row) => (
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
    </div>
  );
}
