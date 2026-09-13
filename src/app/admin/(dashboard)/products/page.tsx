import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Star, TrendingUp } from "lucide-react";

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
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { formatCurrency } from "@/lib/format";
import { deleteProductAction, setProductStatusAction, toggleProductFlagAction } from "@/server/actions/product.actions";
import { listProductsAdmin } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Products",
};

const statusVariant = {
  DRAFT: "outline",
  PUBLISHED: "secondary",
  ARCHIVED: "outline",
} as const;

export default async function AdminProductsPage() {
  const products = await listProductsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>

        <Button render={<Link href="/admin/products/new" />} nativeButton={false} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New product
        </Button>
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
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/products/${product.id}`} className="underline-offset-2 hover:underline">
                    {product.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.categoryName ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[product.status]}>{product.status}</Badge>
                    <form action={setProductStatusAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={product.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
                      />
                      <Button type="submit" size="sm" variant="link" className="h-auto p-0 text-xs">
                        {product.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <form action={toggleProductFlagAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="flag" value="isFeatured" />
                      <input type="hidden" name="value" value={product.isFeatured ? "false" : "true"} />
                      <Button
                        type="submit"
                        variant={product.isFeatured ? "outline" : "ghost"}
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Star className="h-3 w-3" /> {product.isFeatured ? "Featured" : "Feature"}
                      </Button>
                    </form>
                    <form action={toggleProductFlagAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="flag" value="isTrending" />
                      <input type="hidden" name="value" value={product.isTrending ? "false" : "true"} />
                      <Button
                        type="submit"
                        variant={product.isTrending ? "outline" : "ghost"}
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <TrendingUp className="h-3 w-3" /> {product.isTrending ? "Trending" : "Trend"}
                      </Button>
                    </form>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.marketplaceLabels.length > 0 ? product.marketplaceLabels.join(", ") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {product.displayPrice !== null ? formatCurrency(product.displayPrice, product.currency) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      nativeButton={false}
                      render={<Link href={`/admin/products/${product.id}/edit`} />}
                      aria-label={`Edit ${product.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DeleteEntityButton
                      action={deleteProductAction}
                      hiddenFieldName="productId"
                      hiddenFieldValue={product.id}
                      entityLabel={product.title}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No products yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
