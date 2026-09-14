import { ProductCard } from "@/components/public/product-card";
import type { ProductSummary } from "@/types/catalog";

interface ProductGridProps {
  products: ProductSummary[];
  emptyMessage?: string;
}

/** Responsive grid of product cards: 2 cols on mobile, up to 4 on desktop. */
export function ProductGrid({ products, emptyMessage = "No products found." }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
