import type { Metadata } from "next";
import Link from "next/link";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Imports" };

export default function AdminImportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Imports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import canonical RadarCut products plus retailer offers. eBay is live; Amazon and other retailers
          can plug into the same offer model later.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">eBay</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Search by keyword or paste an eBay listing URL. Creates or updates a RadarCut product and an eBay
            retailer offer with an affiliate tracking URL.
          </p>
          <Button nativeButton={false} render={<Link href="/admin/products/import/ebay" />} className="gap-1.5">
            <UploadCloud className="h-4 w-4" />
            Import from eBay
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amazon, Walmart, Best Buy, Target</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not implemented yet. Offers from these retailers will attach to the same Product records without a
            schema redesign.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
