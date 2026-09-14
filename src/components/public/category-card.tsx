import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { categoryIcon } from "@/lib/category-icon";
import type { CategorySummary } from "@/types/catalog";

interface CategoryCardProps {
  category: CategorySummary;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const Icon = categoryIcon(category.slug, category.name);

  return (
    <Link href={`/categories/${category.slug}`} className="group block h-full">
      <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20">
        <CardContent className="flex items-start gap-4 pt-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/10 to-muted text-primary shadow-sm ring-1 ring-primary/10 transition-colors group-hover:from-primary/25 group-hover:via-primary/15 group-hover:text-primary">
            <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold transition-colors group-hover:text-primary">
              {category.name}
            </h3>
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
