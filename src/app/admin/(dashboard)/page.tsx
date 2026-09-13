import type { Metadata } from "next";
import Link from "next/link";
import { Database } from "lucide-react";

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
import { AnalyticsOverview } from "@/components/admin/analytics-overview";
import { PgAdminButton } from "@/components/admin/pgadmin-button";
import { formatCurrency } from "@/lib/format";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { getDashboardAnalytics } from "@/server/services/analytics.service";
import { listProductsAdmin } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

interface AdminDashboardPageProps {
  searchParams: Promise<DateRangeSearchParams>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const [analytics, products] = await Promise.all([getDashboardAnalytics(range), listProductsAdmin()]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live traffic and catalog overview. Revenue attribution is not included.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PgAdminButton />
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/database" />}>
            <Database className="h-4 w-4" />
            Browse tables
          </Button>
        </div>
      </div>

      <AnalyticsOverview data={analytics} basePath="/admin" />

      <div className="rounded-xl border">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Recent products</h2>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/products" />}>
            View all
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.slice(0, 5).map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/products/${product.id}`} className="underline-offset-2 hover:underline">
                    {product.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.categoryName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{product.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {product.displayPrice !== null ? formatCurrency(product.displayPrice, product.currency) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No products yet —{" "}
                  <Link href="/admin/products/new" className="underline">
                    create one
                  </Link>
                  .
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
