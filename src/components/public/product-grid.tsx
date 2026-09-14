import { ProductCard } from "@/components/public/product-card";
import type { ProductSummary } from "@/types/catalog";

interface ProductGridProps {
  products: ProductSummary[];
  emptyMessage?: string;
}

/** Responsive grid of product cards: 1 col on mobile, up to 4 on desktop. */
export function ProductGrid({ products, emptyMessage = "No products found." }: ProductGridProps) {
  if (products.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
