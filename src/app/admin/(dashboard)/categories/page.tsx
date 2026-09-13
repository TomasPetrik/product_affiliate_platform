import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

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
import { deleteCategoryAction } from "@/server/actions/category.actions";
import { listCategoriesAdmin } from "@/server/services/category.service";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function AdminCategoriesPage() {
  const categories = await listCategoriesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </p>
        </div>

        <Button render={<Link href="/admin/categories/new" />} nativeButton={false} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New category
        </Button>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">/{category.slug}</TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {category.description}
                </TableCell>
                <TableCell>
                  <Badge variant={category.isActive ? "secondary" : "outline"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{category.productCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      nativeButton={false}
                      render={<Link href={`/admin/categories/${category.id}/edit`} />}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DeleteEntityButton
                      action={deleteCategoryAction}
                      hiddenFieldName="categoryId"
                      hiddenFieldValue={category.id}
                      entityLabel={category.name}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
