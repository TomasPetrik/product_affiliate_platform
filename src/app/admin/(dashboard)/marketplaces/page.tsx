import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketplaceEditForm } from "@/components/admin/marketplace-edit-form";
import { listMarketplacesAdmin } from "@/server/services/marketplace.service";

export const metadata: Metadata = { title: "Marketplaces" };

export default async function AdminMarketplacesPage() {
  const marketplaces = await listMarketplacesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Retailer destinations used on affiliate links. Product imports stay on a later phase.
        </p>
      </div>

      {marketplaces.length === 0 ? (
        <p className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
          No marketplaces yet. Seed the database to add Amazon and eBay.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {marketplaces.map((marketplace) => (
            <Card key={marketplace.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{marketplace.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{marketplace.code}</p>
                </div>
                <Badge variant={marketplace.isActive ? "secondary" : "outline"}>
                  {marketplace.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-xs text-muted-foreground">
                  {marketplace._count.affiliateLinks} affiliate links · {marketplace._count.revenueEntries}{" "}
                  revenue rows
                </p>
                <MarketplaceEditForm
                  marketplace={{
                    id: marketplace.id,
                    name: marketplace.name,
                    baseUrl: marketplace.baseUrl,
                    logoUrl: marketplace.logoUrl,
                    isActive: marketplace.isActive,
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
