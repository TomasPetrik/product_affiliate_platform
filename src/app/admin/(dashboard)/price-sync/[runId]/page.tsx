import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import {
  getPriceSyncRunById,
  listPriceSyncChanges,
} from "@/server/services/price-sync.service";

interface PageProps {
  params: Promise<{ runId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { runId } = await params;
  return { title: `Price sync · ${runId.slice(0, 8)}` };
}

function priceCell(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  return formatCurrency(amount, currency ?? "USD");
}

export default async function AdminPriceSyncReportPage({ params }: PageProps) {
  const { runId } = await params;
  const run = await getPriceSyncRunById(runId);
  if (!run) notFound();

  const changes = await listPriceSyncChanges(runId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href="/admin/price-sync" />}
            className="mb-2 -ml-2 gap-1.5 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Price sync
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Sync report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.trigger === "CRON" ? "Cron" : "Manual"} · {run.status.toLowerCase()} ·{" "}
            {formatRelativeTime(run.finishedAt ?? run.startedAt ?? run.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{run.changedOffers} updated</Badge>
          <Badge variant="outline">{run.unchangedOffers} unchanged</Badge>
          {run.failedOffers > 0 ? <Badge variant="destructive">{run.failedOffers} failed</Badge> : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Processed {run.processedOffers} of {run.totalOffers} offers
        {run.errorMessage ? ` · ${run.errorMessage}` : ""}.
      </p>

      {changes.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No price changes"
          description={
            run.isActive
              ? "This sync is still running. Refresh shortly to see updates."
              : "Every refreshed offer kept the same price."
          }
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead className="text-right">Old price</TableHead>
                <TableHead className="w-[1%] text-center" />
                <TableHead className="text-right">New price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[280px]">
                    <Link
                      href={`/admin/products/${row.productId}/edit`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.productTitle}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.externalProductId}
                    </p>
                  </TableCell>
                  <TableCell>{row.marketplaceCode}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {priceCell(row.oldPrice, row.currency)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    <ArrowRight className="mx-auto h-3.5 w-3.5" aria-hidden="true" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {priceCell(row.newPrice, row.currency)}
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
