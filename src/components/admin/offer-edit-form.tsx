"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { generateAmazonTrackedAffiliate } from "@/lib/amazon-url";
import { saveRetailerOfferAction, type RetailerOfferActionState } from "@/server/actions/retailer-offer.actions";
import type { AdminRetailerOffer } from "@/server/services/retailer-offer.service";

interface OfferEditFormProps {
  offer: AdminRetailerOffer;
  amazonAssociatesTag?: string | null;
}

const initialState: RetailerOfferActionState = {};

export function OfferEditForm({ offer, amazonAssociatesTag = null }: OfferEditFormProps) {
  const [state, formAction, pending] = useActionState(saveRetailerOfferAction, initialState);
  const router = useRouter();
  const isAmazon = offer.marketplaceCode === "AMAZON";
  const [affiliateUrl, setAffiliateUrl] = useState(offer.affiliateUrl);
  const [rawProductUrl, setRawProductUrl] = useState(offer.productUrl ?? "");
  const [trackingTag, setTrackingTag] = useState(offer.trackingTag ?? "");
  const [tagError, setTagError] = useState<string | null>(null);

  function applyAmazonTracking() {
    setTagError(null);
    if (!amazonAssociatesTag) {
      setTagError("Set AMAZON_ASSOCIATES_TAG in .env, then restart the app.");
      return;
    }
    try {
      const generated = generateAmazonTrackedAffiliate({
        affiliateUrl,
        rawProductUrl,
        asin: offer.externalProductId,
        partnerTag: amazonAssociatesTag,
        productId: offer.productId,
        customId: trackingTag,
      });
      setAffiliateUrl(generated.affiliateUrl);
      setTrackingTag(generated.trackingTag);
      if (!rawProductUrl.trim()) {
        setRawProductUrl(generated.affiliateUrl.split("?")[0] ?? "");
      }
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not apply tracking tag.");
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="offerId" value={offer.id} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {tagError ? (
        <Alert variant="destructive">
          <AlertDescription>{tagError}</AlertDescription>
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
            <Input
              id="affiliateUrl"
              name="affiliateUrl"
              required
              value={affiliateUrl}
              onChange={(event) => setAffiliateUrl(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rawProductUrl">Product URL</Label>
            <Input
              id="rawProductUrl"
              name="rawProductUrl"
              value={rawProductUrl}
              onChange={(event) => setRawProductUrl(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trackingTag">
              {isAmazon ? "Product tracking ID (ascsubtag)" : "Custom / affiliate reference ID"}
            </Label>
            <Input
              id="trackingTag"
              name="trackingTag"
              value={trackingTag}
              onChange={(event) => setTrackingTag(event.target.value)}
              placeholder={isAmazon ? "radarcut-product-… (unique per product)" : undefined}
            />
          </div>

          {isAmazon ? (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {amazonAssociatesTag
                  ? `Account tag “${amazonAssociatesTag}” is added to the URL; this field is a unique product id for reports.`
                  : "Configure AMAZON_ASSOCIATES_TAG in .env to enable one-click tagging."}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={applyAmazonTracking}>
                Generate tracking ID
              </Button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastKnownPrice">Offer price</Label>
              <Input
                id="lastKnownPrice"
                name="lastKnownPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={offer.price != null ? String(offer.price) : ""}
                placeholder="e.g. 29.99"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastKnownOriginalPrice">Original / list price</Label>
              <Input
                id="lastKnownOriginalPrice"
                name="lastKnownOriginalPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={offer.originalPrice != null ? String(offer.originalPrice) : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastKnownPriceCurrency">Currency</Label>
              <Input
                id="lastKnownPriceCurrency"
                name="lastKnownPriceCurrency"
                maxLength={3}
                defaultValue={offer.currency ?? "USD"}
                placeholder="USD"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastKnownAvailability">Availability</Label>
              <select
                id="lastKnownAvailability"
                name="lastKnownAvailability"
                defaultValue={offer.availability || "IN_STOCK"}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="IN_STOCK">In stock</option>
                <option value="LIMITED_QUANTITY">Limited</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
              </select>
            </div>
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
          <p className="text-xs text-muted-foreground">
            Primary offer price can update the product’s display price. Per-retailer prices still show separately in
            “Where to buy”.
          </p>
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
