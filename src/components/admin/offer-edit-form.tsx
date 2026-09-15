"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveRetailerOfferAction, type RetailerOfferActionState } from "@/server/actions/retailer-offer.actions";
import type { AdminRetailerOffer } from "@/server/services/retailer-offer.service";

interface OfferEditFormProps {
  offer: AdminRetailerOffer;
}

const initialState: RetailerOfferActionState = {};

export function OfferEditForm({ offer }: OfferEditFormProps) {
  const [state, formAction, pending] = useActionState(saveRetailerOfferAction, initialState);
  const router = useRouter();

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="offerId" value={offer.id} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{offer.marketplaceName} offer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">Item ID: {offer.externalProductId}</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="affiliateUrl">Affiliate URL</Label>
            <Input id="affiliateUrl" name="affiliateUrl" required defaultValue={offer.affiliateUrl} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rawProductUrl">Product URL</Label>
            <Input id="rawProductUrl" name="rawProductUrl" defaultValue={offer.productUrl} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trackingTag">Custom / affiliate reference ID</Label>
            <Input id="trackingTag" name="trackingTag" defaultValue={offer.trackingTag ?? ""} />
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch id="isActive" name="isActive" defaultChecked={offer.isActive} />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isPrimary" name="isPrimary" defaultChecked={offer.isPrimary} />
              <Label htmlFor="isPrimary">Primary offer</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save offer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/admin/products/${offer.productId}/edit`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
