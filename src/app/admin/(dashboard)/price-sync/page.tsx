import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { PriceSyncControls } from "@/components/admin/price-sync-controls";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/format";
import {
  countActiveEbayOffers,
  getActivePriceSyncRun,
  getLatestCompletedPriceSyncRun,
  listPriceSyncRuns,
} from "@/server/services/price-sync.service";

export const metadata: Metadata = { title: "Price sync" };

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "RUNNING" || status === "PENDING") return "secondary";
  return "outline";
}

export default async function AdminPriceSyncPage() {
  const [activeRun, latestCompleted, runs, offerCount] = await Promise.all([
    getActivePriceSyncRun(),
    getLatestCompletedPriceSyncRun(),
    listPriceSyncRuns(15),
    countActiveEbayOffers(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price sync</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Re-fetch live eBay prices for active offers on a schedule or on demand, then review what
          changed since the last run.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active eBay offers" value={String(offerCount)} icon={RefreshCw} />
        {latestCompleted ? (
          <Link href={`/admin/price-sync/${latestCompleted.id}`} className="block transition-opacity hover:opacity-90">
            <StatCard
              label="Prices updated (last sync)"
              value={String(latestCompleted.changedOffers)}
              icon={ArrowRight}
              hint={`${formatRelativeTime(latestCompleted.finishedAt)} · view report`}
              className="h-full ring-1 ring-transparent hover:ring-border"
            />
          </Link>
        ) : (
          <StatCard
            label="Prices updated (last sync)"
            value="—"
            icon={ArrowRight}
            hint="No completed sync yet"
          />
        )}
        <StatCard
          label="Last sync status"
          value={latestCompleted?.status ?? activeRun?.status ?? "—"}
          icon={RefreshCw}
          hint={
            activeRun
              ? `Running · ${activeRun.percentComplete}%`
              : latestCompleted
                ? formatRelativeTime(latestCompleted.finishedAt)
                : "Waiting for first sync"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync now</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceSyncControls initialActiveRun={activeRun} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                icon={RefreshCw}
                title="No sync runs yet"
                description="Start a manual sync above, or schedule POST /api/cron/price-sync with CRON_SECRET on the VPS."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatRelativeTime(run.finishedAt ?? run.startedAt ?? run.createdAt)}
                    </TableCell>
                    <TableCell>{run.trigger === "CRON" ? "Cron" : "Manual"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{run.changedOffers}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {run.processedOffers}/{run.totalOffers}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/price-sync/${run.id}`}
                        className="text-sm font-medium underline-offset-2 hover:underline"
                      >
                        Report
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
