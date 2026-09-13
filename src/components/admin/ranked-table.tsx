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
}

export function RankedTable({ rows, emptyLabel, showClicks = true, metricLabel = "Views" }: RankedTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">{metricLabel}</TableHead>
          {showClicks ? <TableHead className="text-right">Clicks</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              {row.href ? (
                <Link href={row.href} className="underline-offset-2 hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.views.toLocaleString()}</TableCell>
            {showClicks ? (
              <TableCell className="text-right tabular-nums">{row.clicks.toLocaleString()}</TableCell>
            ) : null}
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showClicks ? 3 : 2} className="py-10 text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
