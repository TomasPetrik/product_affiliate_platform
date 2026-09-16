"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Star, TrendingUp } from "lucide-react";

import { ConfirmFormButton } from "@/components/admin/confirm-form-button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { toggleSortHref, type ProductAdminQuery, type ProductSortField } from "@/lib/product-admin-query";
import { productThumbImageUrl } from "@/lib/product-image-variants";
import {
  bulkSetProductStatusAction,
  deleteProductAction,
  setProductStatusAction,
  toggleProductFlagAction,
} from "@/server/actions/product.actions";
import type { ProductAdminRow } from "@/server/services/product.service";

const statusVariant = {
  DRAFT: "outline",
  PUBLISHED: "secondary",
  ARCHIVED: "outline",
} as const;

interface ProductTableProps {
  products: ProductAdminRow[];
  query: ProductAdminQuery;
  returnTo: string;
}

export function ProductTable({ products, query, returnTo }: ProductTableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const ids = useMemo(() => products.map((product) => product.id), [products]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : ids);
  }

  function toggleOne(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="flex flex-col gap-3">
      <BulkToolbar selectedIds={selected} returnTo={returnTo} />

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all products on this page"
                />
              </TableHead>
              <TableHead className="w-14">Image</TableHead>
              <SortableHead field="title" query={query}>
                Title
              </SortableHead>
              <TableHead>Category</TableHead>
              <SortableHead field="status" query={query}>
                Status
              </SortableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Marketplaces</TableHead>
              <SortableHead field="displayPrice" query={query} className="text-right">
                Price
              </SortableHead>
              <SortableHead field="updatedAt" query={query}>
                Updated
              </SortableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} data-selected={selected.includes(product.id) ? "true" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected.includes(product.id)}
                    onChange={() => toggleOne(product.id)}
                    aria-label={`Select ${product.title}`}
                  />
                </TableCell>
                <TableCell>
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productThumbImageUrl(product.imageUrl) ?? product.imageUrl}
                      alt=""
                      className="size-10 rounded-md object-cover"
                      onError={(event) => {
                        event.currentTarget.src = product.imageUrl!;
                      }}
                    />
                  ) : (
                    <div className="size-10 rounded-md bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/admin/products/${product.id}`} className="underline-offset-2 hover:underline">
                    {product.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.categoryName ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[product.status]}>{product.status}</Badge>
                    {product.status !== "ARCHIVED" ? (
                      <ConfirmFormButton
                        action={setProductStatusAction}
                        fields={{
                          productId: product.id,
                          status: product.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                        }}
                        title={product.status === "PUBLISHED" ? `Unpublish ${product.title}?` : `Publish ${product.title}?`}
                        description={
                          product.status === "PUBLISHED"
                            ? "The product will become a draft and disappear from the public site."
                            : "The product will become visible on the public site."
                        }
                        confirmLabel={product.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        trigger={
                          <Button type="button" size="sm" variant="link" className="h-auto p-0 text-xs">
                            {product.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                          </Button>
                        }
                      />
                    ) : null}
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
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(product.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      nativeButton={false}
                      render={<Link href={`/admin/products/${product.id}/preview`} target="_blank" />}
                      aria-label={`Preview ${product.title}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                      extraFields={{ returnTo }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  No products match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortableHead({
  field,
  query,
  className,
  children,
}: {
  field: ProductSortField;
  query: ProductAdminQuery;
  className?: string;
  children: string;
}) {
  const active = query.sort === field;
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={className}>
      <Link href={toggleSortHref(query, field)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <Icon className="h-3.5 w-3.5" />
      </Link>
    </TableHead>
  );
}

function BulkToolbar({ selectedIds, returnTo }: { selectedIds: string[]; returnTo: string }) {
  const publishFormId = useId();
  const unpublishFormId = useId();
  const disabled = selectedIds.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-muted-foreground">
        {selectedIds.length === 0
          ? "Select products for bulk actions"
          : `${selectedIds.length} selected on this page`}
      </p>

      <form id={publishFormId} action={bulkSetProductStatusAction} className="hidden">
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="productIds" value={id} />
        ))}
        <input type="hidden" name="status" value="PUBLISHED" />
        <input type="hidden" name="returnTo" value={returnTo} />
      </form>
      <form id={unpublishFormId} action={bulkSetProductStatusAction} className="hidden">
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="productIds" value={id} />
        ))}
        <input type="hidden" name="status" value="DRAFT" />
        <input type="hidden" name="returnTo" value={returnTo} />
      </form>

      <AlertDialog>
        <AlertDialogTrigger
          disabled={disabled}
          render={<Button type="button" size="sm" variant="outline" disabled={disabled} />}
        >
          Publish selected
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {selectedIds.length} products?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected products will become visible on the public site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={publishFormId}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger
          disabled={disabled}
          render={<Button type="button" size="sm" variant="outline" disabled={disabled} />}
        >
          Unpublish selected
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish {selectedIds.length} products?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected products will become drafts and will no longer appear on the public site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={unpublishFormId}>
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

