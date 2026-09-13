import Link from "next/link";
import { Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { CategorySummary } from "@/types/catalog";

interface CategoryCardProps {
  category: CategorySummary;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link href={`/categories/${category.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3 pt-4">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{category.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{category.description}</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {category.productCount} {category.productCount === 1 ? "product" : "products"}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
