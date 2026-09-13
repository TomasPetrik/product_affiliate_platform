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
import { getAllCategories, getAllProducts } from "@/lib/placeholder-data";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminDashboardPage() {
  const products = getAllProducts();
  const categories = getAllCategories();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your catalog. Traffic and revenue metrics arrive in a later phase.
        </p>
      </div>

      <Alert>
        <AlertTitle>Analytics not wired up yet</AlertTitle>
        <AlertDescription>
          Page views, CTR, traffic sources and revenue reporting are part of Phase 4/6 of the
          approved roadmap. The numbers below reflect the current placeholder catalog only.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total products" value={String(products.length)} icon={Package} />
        <StatCard label="Categories" value={String(categories.length)} icon={FolderTree} />
        <StatCard label="Page views" value="—" icon={Eye} hint="Available in Phase 4" />
        <StatCard label="Affiliate clicks" value="—" icon={MousePointerClick} hint="Available in Phase 4" />
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
                <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{product.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(product.displayPrice, product.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
