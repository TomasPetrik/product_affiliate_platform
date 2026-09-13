import type { Metadata } from "next";
import { Plus } from "lucide-react";

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
import { getAllCategories } from "@/lib/placeholder-data";

export const metadata: Metadata = {
  title: "Categories",
};

export default function AdminCategoriesPage() {
  const categories = getAllCategories();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length} categories in the placeholder catalog.
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger render={<Button disabled className="gap-1.5" />}>
            <Plus className="h-4 w-4" />
            New category
          </TooltipTrigger>
          <TooltipContent>Category creation ships with CRUD in Phase 2</TooltipContent>
        </Tooltip>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Products</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">/{category.slug}</TableCell>
                <TableCell className="max-w-md text-muted-foreground">{category.description}</TableCell>
                <TableCell className="text-right">{category.productCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Read-only preview. Category create/edit/delete land with Category CRUD in Phase 2.
      </p>
    </div>
  );
}
