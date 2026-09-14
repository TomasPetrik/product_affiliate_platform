import { createElement } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProductImagePlaceholder } from "@/components/public/product-image-placeholder";
import { categoryTagline } from "@/lib/category-copy";
import { categoryIcon } from "@/lib/category-icon";
import { cn } from "@/lib/utils";
import type { CategorySummary } from "@/types/catalog";

interface CategoryCardProps {
  category: CategorySummary;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const tagline = categoryTagline(category.slug, category.name, category.description);
  const Icon = categoryIcon(category.slug, category.name);

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
    "group relative isolate flex h-full min-h-[14rem] min-w-0 overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]",
        "transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        "sm:min-h-[16.5rem]",
      )}
    >
      {category.imageUrl ? (
        <ProductImagePlaceholder
          seed={category.slug}
          src={category.imageUrl}
          alt=""
          fit="cover"
          className="absolute inset-0 h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 bg-image-well" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/28 to-black/10" />

      <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          {!category.imageUrl ? (
            <div className="mb-3 flex size-10 items-center justify-center rounded-[12px] border border-white/20 bg-white/10 text-white">
              {createElement(Icon, { className: "size-5", strokeWidth: 1.75, "aria-hidden": true })}
            </div>
          ) : null}
          <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white">{category.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/80">{tagline}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-200 group-hover:bg-white/25">
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
