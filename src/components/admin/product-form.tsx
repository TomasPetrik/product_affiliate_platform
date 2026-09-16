"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProductImagesField, type ProductImageFieldValue } from "@/components/admin/product-images-field";
import { saveProductAction, type ProductActionState } from "@/server/actions/product.actions";

import { generateAmazonTrackedAffiliate } from "@/lib/amazon-url";
import { slugify } from "@/lib/slug";

export interface ProductFormLinkValues {
  affiliateUrl: string;
  rawProductUrl: string;
  externalProductId: string;
  trackingTag: string;
  lastKnownPrice: string;
  lastKnownOriginalPrice: string;
  lastKnownPriceCurrency: string;
  lastKnownAvailability: string;
  isActive: boolean;
}

export interface ProductFormValues {
  id?: string;
  title: string;
  slug: string;
  brand: string;
  modelNumber: string;
  gtin: string;
  mpn: string;
  categoryId: string;
  shortDescription: string;
  longDescription: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured: boolean;
  isTrending: boolean;
  currency: string;
  displayPrice: string;
  originalPrice: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  images: ProductImageFieldValue[];
  links: Record<string, ProductFormLinkValues>;
  primaryMarketplaceId: string;
}

const emptyLink: ProductFormLinkValues = {
  affiliateUrl: "",
  rawProductUrl: "",
  externalProductId: "",
  trackingTag: "",
  lastKnownPrice: "",
  lastKnownOriginalPrice: "",
  lastKnownPriceCurrency: "",
  lastKnownAvailability: "",
  isActive: true,
};

export const emptyProductFormValues: ProductFormValues = {
  title: "",
  slug: "",
  brand: "",
  modelNumber: "",
  gtin: "",
  mpn: "",
  categoryId: "",
  shortDescription: "",
  longDescription: "",
  status: "DRAFT",
  isFeatured: false,
  isTrending: false,
  currency: "USD",
  displayPrice: "",
  originalPrice: "",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  images: [],
  links: {},
  primaryMarketplaceId: "",
};

interface ProductFormProps {
  defaultValues?: ProductFormValues;
  categories: Array<{ id: string; name: string; parent: { name: string } | null }>;
  marketplaces: Array<{ id: string; code: string; name: string }>;
  /** Associates account tag from AMAZON_ASSOCIATES_TAG; enables Generate tracking ID. */
  amazonAssociatesTag?: string | null;
}

const initialState: ProductActionState = {};

type AmazonLinkDraft = {
  affiliateUrl: string;
  rawProductUrl: string;
  externalProductId: string;
  trackingTag: string;
};

export function ProductForm({
  defaultValues = emptyProductFormValues,
  categories,
  marketplaces,
  amazonAssociatesTag = null,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);
  const [slug, setSlug] = useState(defaultValues.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.id));
  const [status, setStatus] = useState(defaultValues.status);
  const [categoryId, setCategoryId] = useState(defaultValues.categoryId || categories[0]?.id || "");
  const [amazonDrafts, setAmazonDrafts] = useState<Record<string, AmazonLinkDraft>>(() => {
    const drafts: Record<string, AmazonLinkDraft> = {};
    for (const marketplace of marketplaces) {
      if (marketplace.code !== "AMAZON") continue;
      const link = defaultValues.links[marketplace.id] ?? emptyLink;
      drafts[marketplace.id] = {
        affiliateUrl: link.affiliateUrl,
        rawProductUrl: link.rawProductUrl,
        externalProductId: link.externalProductId,
        trackingTag: link.trackingTag,
      };
    }
    return drafts;
  });
  const [amazonTagError, setAmazonTagError] = useState<string | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.error) {
      return;
    }
    errorAlertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.error]);

  function updateAmazonDraft(marketplaceId: string, patch: Partial<AmazonLinkDraft>) {
    setAmazonDrafts((prev) => ({
      ...prev,
      [marketplaceId]: {
        ...(prev[marketplaceId] ?? {
          affiliateUrl: "",
          rawProductUrl: "",
          externalProductId: "",
          trackingTag: "",
        }),
        ...patch,
      },
    }));
  }

  function applyAmazonTracking(marketplaceId: string) {
    setAmazonTagError(null);
    if (!amazonAssociatesTag) {
      setAmazonTagError("Set AMAZON_ASSOCIATES_TAG in .env, then restart the app.");
      return;
    }
    const draft = amazonDrafts[marketplaceId] ?? {
      affiliateUrl: "",
      rawProductUrl: "",
      externalProductId: "",
      trackingTag: "",
    };
    try {
      const generated = generateAmazonTrackedAffiliate({
        affiliateUrl: draft.affiliateUrl,
        rawProductUrl: draft.rawProductUrl,
        asin: draft.externalProductId,
        partnerTag: amazonAssociatesTag,
        productId: defaultValues.id,
        customId: draft.trackingTag,
      });
      updateAmazonDraft(marketplaceId, {
        affiliateUrl: generated.affiliateUrl,
        trackingTag: generated.trackingTag,
        externalProductId: generated.asin ?? draft.externalProductId,
        rawProductUrl: draft.rawProductUrl || generated.affiliateUrl.split("?")[0] || draft.rawProductUrl,
      });
    } catch (error) {
      setAmazonTagError(error instanceof Error ? error.message : "Could not apply tracking tag.");
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {defaultValues.id ? <input type="hidden" name="productId" value={defaultValues.id} /> : null}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="categoryId" value={categoryId} />

      {state.error ? (
        <div ref={errorAlertRef}>
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={defaultValues.title}
              onChange={(event) => {
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">Public URL: /products/{slug || "…"}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" required defaultValue={defaultValues.brand} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modelNumber">Model</Label>
              <Input id="modelNumber" name="modelNumber" defaultValue={defaultValues.modelNumber} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gtin">GTIN / UPC / EAN</Label>
              <Input id="gtin" name="gtin" defaultValue={defaultValues.gtin} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mpn">MPN</Label>
              <Input id="mpn" name="mpn" defaultValue={defaultValues.mpn} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId || undefined} onValueChange={(value) => setCategoryId(value ?? "")}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.parent ? `${category.parent.name} / ${category.name}` : category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 ? (
                <p className="text-xs text-destructive">
                  No categories yet — create one first, a category is required.
                </p>
              ) : null}
            </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shortDescription">Short description</Label>
            <Textarea id="shortDescription" name="shortDescription" rows={2} required defaultValue={defaultValues.shortDescription} />
            <p className="text-xs text-muted-foreground">Shown on product cards and search results.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="longDescription">Long description</Label>
            <Textarea id="longDescription" name="longDescription" rows={6} required defaultValue={defaultValues.longDescription} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing &amp; status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" maxLength={3} defaultValue={defaultValues.currency || "USD"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayPrice">Display price</Label>
              <Input id="displayPrice" name="displayPrice" type="number" step="0.01" min={0} required defaultValue={defaultValues.displayPrice} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="originalPrice">Original price (optional)</Label>
              <Input id="originalPrice" name="originalPrice" type="number" step="0.01" min={0} defaultValue={defaultValues.originalPrice} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Reference prices only — always confirmed on the marketplace at checkout.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statusSelect">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ProductFormValues["status"])}>
              <SelectTrigger id="statusSelect" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch id="isFeatured" name="isFeatured" defaultChecked={defaultValues.isFeatured} />
              <Label htmlFor="isFeatured">Featured</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isTrending" name="isTrending" defaultChecked={defaultValues.isTrending} />
              <Label htmlFor="isTrending">Trending</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Images</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImagesField defaultImages={defaultValues.images} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual affiliate URLs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-xs text-muted-foreground">
            Use this for Amazon (and other retailers without import yet). Set a per-retailer price so “Where to buy”
            can show Amazon separately from the product/eBay price. Prefer Import / Add eBay offer for eBay so seller
            and tracking stay in sync.
          </p>
          {amazonTagError ? (
            <Alert variant="destructive">
              <AlertDescription>{amazonTagError}</AlertDescription>
            </Alert>
          ) : null}

          {marketplaces.map((marketplace) => {
            const link = defaultValues.links[marketplace.id] ?? emptyLink;
            const isAmazon = marketplace.code === "AMAZON";
            const amazonDraft = amazonDrafts[marketplace.id];
            return (
              <div key={marketplace.id} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{marketplace.name}</p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="primaryMarketplaceId"
                        value={marketplace.id}
                        defaultChecked={
                          defaultValues.primaryMarketplaceId
                            ? defaultValues.primaryMarketplaceId === marketplace.id
                            : !defaultValues.primaryMarketplaceId && marketplace.id === marketplaces[0]?.id
                        }
                      />
                      Primary
                    </label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`link_${marketplace.id}_isActive`}
                        name={`link_${marketplace.id}_isActive`}
                        defaultChecked={link.isActive}
                      />
                      <Label htmlFor={`link_${marketplace.id}_isActive`} className="text-xs">
                        Active
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`link_${marketplace.id}_affiliateUrl`} className="text-xs">
                    Affiliate URL
                    {isAmazon ? " (account tag + product id applied)" : " (leave blank to skip)"}
                  </Label>
                  <Input
                    id={`link_${marketplace.id}_affiliateUrl`}
                    name={`link_${marketplace.id}_affiliateUrl`}
                    placeholder={
                      isAmazon
                        ? "https://www.amazon.com/dp/B0… or paste then Apply tracking tag"
                        : `https://www.${marketplace.code.toLowerCase()}.com/...`
                    }
                    {...(isAmazon && amazonDraft
                      ? {
                          value: amazonDraft.affiliateUrl,
                          onChange: (event: ChangeEvent<HTMLInputElement>) =>
                            updateAmazonDraft(marketplace.id, { affiliateUrl: event.target.value }),
                        }
                      : { defaultValue: link.affiliateUrl })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_rawProductUrl`} className="text-xs">
                      Raw product URL
                    </Label>
                    <Input
                      id={`link_${marketplace.id}_rawProductUrl`}
                      name={`link_${marketplace.id}_rawProductUrl`}
                      {...(isAmazon && amazonDraft
                        ? {
                            value: amazonDraft.rawProductUrl,
                            onChange: (event: ChangeEvent<HTMLInputElement>) =>
                              updateAmazonDraft(marketplace.id, { rawProductUrl: event.target.value }),
                          }
                        : { defaultValue: link.rawProductUrl })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_externalProductId`} className="text-xs">
                      {isAmazon ? "ASIN (auto from URL if blank)" : "External product ID"}
                    </Label>
                    <Input
                      id={`link_${marketplace.id}_externalProductId`}
                      name={`link_${marketplace.id}_externalProductId`}
                      placeholder={isAmazon ? "B0XXXXXXXX" : undefined}
                      {...(isAmazon && amazonDraft
                        ? {
                            value: amazonDraft.externalProductId,
                            onChange: (event: ChangeEvent<HTMLInputElement>) =>
                              updateAmazonDraft(marketplace.id, { externalProductId: event.target.value }),
                          }
                        : { defaultValue: link.externalProductId })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_trackingTag`} className="text-xs">
                      {isAmazon ? "Product tracking ID (ascsubtag)" : "Tracking tag"}
                    </Label>
                    <Input
                      id={`link_${marketplace.id}_trackingTag`}
                      name={`link_${marketplace.id}_trackingTag`}
                      placeholder={
                        isAmazon ? "radarcut-product-… (unique per product)" : undefined
                      }
                      {...(isAmazon && amazonDraft
                        ? {
                            value: amazonDraft.trackingTag,
                            onChange: (event: ChangeEvent<HTMLInputElement>) =>
                              updateAmazonDraft(marketplace.id, { trackingTag: event.target.value }),
                          }
                        : { defaultValue: link.trackingTag })}
                    />
                  </div>
                </div>

                {isAmazon ? (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {amazonAssociatesTag
                        ? `Account tag “${amazonAssociatesTag}” is added to the URL; this field is a unique product id for reports.`
                        : "Configure AMAZON_ASSOCIATES_TAG in .env to enable one-click tagging."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyAmazonTracking(marketplace.id)}
                    >
                      Generate tracking ID
                    </Button>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_lastKnownPrice`} className="text-xs">
                      Offer price
                    </Label>
                    <Input
                      id={`link_${marketplace.id}_lastKnownPrice`}
                      name={`link_${marketplace.id}_lastKnownPrice`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={link.lastKnownPrice}
                      placeholder="e.g. 29.99"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_lastKnownOriginalPrice`} className="text-xs">
                      Original / list price
                    </Label>
                    <Input
                      id={`link_${marketplace.id}_lastKnownOriginalPrice`}
                      name={`link_${marketplace.id}_lastKnownOriginalPrice`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={link.lastKnownOriginalPrice}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_lastKnownPriceCurrency`} className="text-xs">
                      Currency
                    </Label>
                    <Input
                      id={`link_${marketplace.id}_lastKnownPriceCurrency`}
                      name={`link_${marketplace.id}_lastKnownPriceCurrency`}
                      maxLength={3}
                      defaultValue={link.lastKnownPriceCurrency || defaultValues.currency || "USD"}
                      placeholder="USD"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`link_${marketplace.id}_lastKnownAvailability`} className="text-xs">
                      Availability
                    </Label>
                    <select
                      id={`link_${marketplace.id}_lastKnownAvailability`}
                      name={`link_${marketplace.id}_lastKnownAvailability`}
                      defaultValue={link.lastKnownAvailability || "IN_STOCK"}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="IN_STOCK">In stock</option>
                      <option value="LIMITED_QUANTITY">Limited</option>
                      <option value="OUT_OF_STOCK">Out of stock</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seoTitle">SEO title</Label>
            <Input id="seoTitle" name="seoTitle" defaultValue={defaultValues.seoTitle} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seoDescription">SEO description</Label>
            <Textarea id="seoDescription" name="seoDescription" rows={2} defaultValue={defaultValues.seoDescription} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ogImageUrl">OG image URL</Label>
            <Input
              id="ogImageUrl"
              name="ogImageUrl"
              defaultValue={defaultValues.ogImageUrl}
              placeholder="Defaults to the primary product image"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : defaultValues.id ? "Save changes" : "Create product"}
        </Button>
        {defaultValues.id ? (
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/admin/products/${defaultValues.id}/preview`} target="_blank" rel="noreferrer" />}
          >
            Preview
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
