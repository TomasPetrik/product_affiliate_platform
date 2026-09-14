import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/public/container";
import { ProductCard, SpotlightProductCard } from "@/components/public/product-card";
import { ProductGrid } from "@/components/public/product-grid";
import { SectionHeading } from "@/components/public/section-heading";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";

interface ProductCollectionProps {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  href: string;
  products: ProductSummary[];
  tone?: "default" | "muted";
  layout?: "grid" | "spotlight";
}

export function ProductCollection({
  id,
  eyebrow,
  title,
  description,
  href,
  products,
  tone = "default",
  layout = "grid",
}: ProductCollectionProps) {
  if (products.length === 0) {
    return null;
  }

  const [spotlight, ...rest] = products;
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("py-14 sm:py-20", tone === "muted" && "bg-muted/70")}
    >
      <Container>
        <SectionHeading
          id={headingId}
          eyebrow={eyebrow}
          title={title}
          description={description}
          viewAllHref={href}
        />
        <div className="mt-10">
          {layout === "spotlight" && spotlight ? (
            <div className="flex flex-col gap-6">
              <SpotlightProductCard product={spotlight} />
              {rest.length > 0 ? (
                <div className="grid min-w-0 grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-3">
                  {rest.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
        <Link
          href={href}
          className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 transition-colors duration-200 hover:text-foreground sm:hidden"
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}
