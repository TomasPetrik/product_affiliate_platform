import type { Metadata } from "next";
import Link from "next/link";
import { Eye, FolderTree, MousePointerClick, Package } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { StatCard } from "@/components/admin/stat-card";
import { formatCurrency } from "@/lib/format";
import { listCategoriesAdmin } from "@/server/services/category.service";
import { listProductsAdmin } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const [products, categories] = await Promise.all([listProductsAdmin(), listCategoriesAdmin()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your catalog.</p>
      </div>

      <Alert>
        <AlertTitle>Analytics not wired up yet</AlertTitle>
        <AlertDescription>
          Page views, CTR, traffic sources and revenue reporting are part of a later phase of the
          approved roadmap. Catalog data below is live from the database.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total products" value={String(products.length)} icon={Package} />
        <StatCard label="Categories" value={String(categories.length)} icon={FolderTree} />
        <StatCard label="Page views" value="—" icon={Eye} hint="Available in a later phase" />
        <StatCard label="Affiliate clicks" value="—" icon={MousePointerClick} hint="Available in a later phase" />
      </div>

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
                <TableCell className="font-medium">{product.title}</TableCell>
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
                  No products yet — <Link href="/admin/products/new" className="underline">create one</Link>.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
