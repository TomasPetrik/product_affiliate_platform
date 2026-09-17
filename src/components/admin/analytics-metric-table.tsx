import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCtr } from "@/lib/analytics-attribution";
import type { ReportRow } from "@/server/services/analytics-reports.service";

interface AnalyticsMetricTableProps {
  rows: ReportRow[];
  emptyLabel: string;
  nameLabel?: string;
  viewsLabel?: string;
  showSessions?: boolean;
  showOfferViews?: boolean;
}

export function AnalyticsMetricTable({
  rows,
  emptyLabel,
  nameLabel = "Name",
  viewsLabel = "Product views",
  showSessions = true,
  showOfferViews = false,
}: AnalyticsMetricTableProps) {
  const columns = 4 + (showSessions ? 1 : 0) + (showOfferViews ? 1 : 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{nameLabel}</TableHead>
          <TableHead className="text-right">Visitors</TableHead>
          {showSessions ? <TableHead className="text-right">Sessions</TableHead> : null}
          <TableHead className="text-right">{viewsLabel}</TableHead>
          {showOfferViews ? <TableHead className="text-right">Offer views</TableHead> : null}
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead className="text-right">CTR</TableHead>
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
            <TableCell className="text-right tabular-nums">{row.visitors.toLocaleString()}</TableCell>
            {showSessions ? (
              <TableCell className="text-right tabular-nums">{row.sessions.toLocaleString()}</TableCell>
            ) : null}
            <TableCell className="text-right tabular-nums">{row.views.toLocaleString()}</TableCell>
            {showOfferViews ? (
              <TableCell className="text-right tabular-nums">{(row.offerViews ?? row.views).toLocaleString()}</TableCell>
            ) : null}
            <TableCell className="text-right tabular-nums">{row.clicks.toLocaleString()}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCtr(row.ctr)}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns + 1} className="py-10 text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
