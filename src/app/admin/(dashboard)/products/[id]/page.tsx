import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, MousePointerClick, Pencil, Percent } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/admin/stat-card";
import { formatCurrency } from "@/lib/format";
import { resolveDateRange } from "@/lib/date-range";
import { getProductAnalyticsSummary } from "@/server/services/analytics.service";
import { getProductByIdAdmin } from "@/server/services/product.service";

export const metadata: Metadata = {
  title: "Product",
};

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductByIdAdmin(id);

  if (!product) {
    notFound();
  }

  const range = resolveDateRange({ range: "30d" });
  const stats = await getProductAnalyticsSummary(product.id, range);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Product</p>
          <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/{product.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/admin/products/${product.id}/preview`} />}>
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button nativeButton={false} render={<Link href={`/admin/products/${product.id}/edit`} />}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Views (30d)" value={String(stats.views)} icon={Eye} />
        <StatCard label="Clicks (30d)" value={String(stats.clicks)} icon={MousePointerClick} />
        <StatCard
          label="CTR (30d)"
          value={stats.ctr === null ? "—" : `${stats.ctr.toFixed(1)}%`}
          icon={Percent}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Brand:</span> {product.brand}
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span> {product.category?.name ?? "—"}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="secondary">{product.status}</Badge>
            </p>
            <p>
              <span className="text-muted-foreground">Price:</span>{" "}
              {formatCurrency(Number(product.displayPrice), product.currency)}
            </p>
            <p>
              <span className="text-muted-foreground">Flags:</span>{" "}
              {[product.isFeatured ? "Featured" : null, product.isTrending ? "Trending" : null]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
            <p className="text-muted-foreground">{product.shortDescription}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Affiliate links</CardTitle>
          </CardHeader>
          <CardContent>
            {product.affiliateLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No marketplace links yet.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {product.affiliateLinks.map((link) => (
                  <li key={link.id} className="rounded-md border px-3 py-2">
                    <p className="font-medium">{link.marketplace.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{link.affiliateUrl}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
