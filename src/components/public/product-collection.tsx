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
      className={cn("py-8 sm:py-12", tone === "muted" && "bg-muted/50")}
    >
      <Container>
        <SectionHeading
          id={headingId}
          eyebrow={eyebrow}
          title={title}
          description={description}
          viewAllHref={href}
        />
        <div className="mt-8">
          {layout === "spotlight" && spotlight ? (
            <div className="flex flex-col gap-5">
              <SpotlightProductCard product={spotlight} />
              {rest.length > 0 ? (
                <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 lg:grid-cols-3">
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
          className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 transition-colors hover:text-primary sm:hidden"
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}
