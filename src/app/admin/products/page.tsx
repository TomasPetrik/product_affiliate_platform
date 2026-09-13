import type { Metadata } from "next";
import { Plus, Star, TrendingUp } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import { getAllProducts } from "@/lib/placeholder-data";

export const metadata: Metadata = {
  title: "Products",
};

export default function AdminProductsPage() {
  const products = getAllProducts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} products in the placeholder catalog.
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger render={<Button disabled className="gap-1.5" />}>
            <Plus className="h-4 w-4" />
            New product
          </TooltipTrigger>
          <TooltipContent>Product creation ships with CRUD in Phase 2</TooltipContent>
        </Tooltip>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Marketplaces</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.title}</TableCell>
                <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{product.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {product.isFeatured ? (
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3" /> Featured
                      </Badge>
                    ) : null}
                    {product.isTrending ? (
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="h-3 w-3" /> Trending
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.marketplaces.map((m) => m.label).join(", ")}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(product.displayPrice, product.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        This is a read-only preview of the catalog. Create, edit, publish/unpublish and affiliate
        link management land with Product CRUD in Phase 2.
      </p>
    </div>
  );
}
