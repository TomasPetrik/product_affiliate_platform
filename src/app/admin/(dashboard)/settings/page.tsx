import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  const [productCount, categoryCount, marketplaceCount, revenueCount] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.marketplace.count(),
    prisma.revenueEntry.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Site identity, signed-in admin, and marketplace connections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Signed-in admin</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {session?.name || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {session?.email || "—"}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Role:</span>
              <Badge variant="secondary">{session?.role}</Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Site</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Public URL:</span> {env.NEXT_PUBLIC_SITE_URL}
            </p>
            <p>
              <span className="text-muted-foreground">Environment:</span> {env.NODE_ENV}
            </p>
            <p className="text-muted-foreground">
              {productCount} products · {categoryCount} categories · {marketplaceCount} marketplaces
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Marketplaces</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Amazon and eBay destinations are managed on the marketplaces page. Import jobs stay
              deferred until a retailer API is connected.
            </p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/marketplaces" />}>
              Open marketplaces
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue imports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Affiliate networks often do not expose order-level data. A revenue import table is
              ready for later manual commission uploads. Attribution is not calculated yet.
            </p>
            <p className="text-muted-foreground">{revenueCount} imported rows on file.</p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/revenue" />}>
              Open revenue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
