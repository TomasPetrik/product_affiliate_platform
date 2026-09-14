import { createElement } from "react";
import Link from "next/link";

import { categoryIcon } from "@/lib/category-icon";
import { cn } from "@/lib/utils";
import type { CategorySummary } from "@/types/catalog";

interface CategoryCardProps {
  category: CategorySummary;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group flex h-full items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
      )}
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/70 text-foreground">
        {createElement(categoryIcon(category.slug, category.name), {
          className: "size-5",
          strokeWidth: 1.75,
          "aria-hidden": true,
        })}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
          {category.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {category.productCount} {category.productCount === 1 ? "product" : "products"}
        </p>
      </div>
    </Link>
  );
}
