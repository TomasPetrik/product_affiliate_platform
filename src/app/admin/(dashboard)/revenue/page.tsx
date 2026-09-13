import type { Metadata } from "next";

import { DollarSign } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { listRevenueEntries } from "@/server/services/analytics.service";

export const metadata: Metadata = { title: "Revenue" };

export default async function AdminRevenuePage() {
  const entries = await listRevenueEntries();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual commission imports only. Click-to-order attribution is not implemented because
          Amazon and eBay typically do not expose order-level data to publishers.
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No commission rows yet"
          description="This table is ready for later CSV or form imports into revenue_entries (amount, marketplace, product, report date). Nothing is attributed from outbound clicks today."
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.occurredOn.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{entry.marketplace?.name ?? "—"}</TableCell>
                  <TableCell>{entry.product?.title ?? "—"}</TableCell>
                  <TableCell>{entry.source}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(entry.amount), entry.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
