"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

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
import { cn } from "@/lib/utils";

import type { SocialPlatform } from "@/generated/prisma/enums";
import {
  AMAZON_HOP_PLATFORMS,
  resolveAmazonAssociatesTagForPlatform,
  type AmazonAssociatesTagsByPlatform,
} from "@/lib/amazon-platform-tags";
import { generateAmazonTrackedAffiliate } from "@/lib/amazon-url";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/social-external-id";
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

export type ProductFormAmazonPlatformLinks = Record<SocialPlatform, string>;

export interface ProductFormValues {
  id?: string;
  /** Integer used for short Instagram URLs (`/p/{publicId}`). */
  publicId?: number;
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
  /** Amazon marketplace id → per-platform affiliate URLs. */
  amazonPlatformLinks?: Record<string, ProductFormAmazonPlatformLinks>;
  primaryMarketplaceId: string;
}

function emptyAmazonPlatformLinks(): ProductFormAmazonPlatformLinks {
  return {
    INSTAGRAM: "",
    FACEBOOK: "",
    YOUTUBE: "",
    TIKTOK: "",
  };
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
  amazonPlatformLinks: {},
  primaryMarketplaceId: "",
};

/** Stable id so Basics fields can sit outside the <form> (edit-page two-column layout). */
export const ADMIN_PRODUCT_FORM_ID = "admin-product-form";

interface ProductFormProps {
  defaultValues?: ProductFormValues;
  categories: Array<{ id: string; name: string; parent: { name: string } | null }>;
  marketplaces: Array<{ id: string; code: string; name: string }>;
  /** Per-platform Associates store tags; enables Generate platform links. */
  amazonAssociatesTags?: AmazonAssociatesTagsByPlatform | null;
  /** Legacy fallback when a platform-specific tag is missing. */
  amazonAssociatesTag?: string | null;
  /**
   * Custom layout. Use `basics` beside other panels and `fields` for the rest of the form.
   * Basics inputs associate via `form={ADMIN_PRODUCT_FORM_ID}` so they still submit.
   */
  children?: (parts: { basics: ReactNode; fields: ReactNode }) => ReactNode;
}

const initialState: ProductActionState = {};

type AmazonLinkDraft = {
  rawProductUrl: string;
  externalProductId: string;
  trackingTag: string;
  platforms: ProductFormAmazonPlatformLinks;
};

export function ProductForm({
  defaultValues = emptyProductFormValues,
  categories,
  marketplaces,
  amazonAssociatesTags = null,
  amazonAssociatesTag = null,
  children,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);
  const [slug, setSlug] = useState(defaultValues.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.id));
  const [status, setStatus] = useState(defaultValues.status);
  const [categoryId, setCategoryId] = useState(defaultValues.categoryId || categories[0]?.id || "");
  const platformTags: AmazonAssociatesTagsByPlatform = amazonAssociatesTags ?? {
    INSTAGRAM: null,
    FACEBOOK: null,
    YOUTUBE: null,
    TIKTOK: null,
  };
  const [amazonDrafts, setAmazonDrafts] = useState<Record<string, AmazonLinkDraft>>(() => {
    const drafts: Record<string, AmazonLinkDraft> = {};
    for (const marketplace of marketplaces) {
      if (marketplace.code !== "AMAZON") continue;
      const link = defaultValues.links[marketplace.id] ?? emptyLink;
      drafts[marketplace.id] = {
        rawProductUrl: link.rawProductUrl,
        externalProductId: link.externalProductId,
        trackingTag: link.trackingTag,
        platforms: {
          ...emptyAmazonPlatformLinks(),
          ...(defaultValues.amazonPlatformLinks?.[marketplace.id] ?? {}),
        },
      };
    }
    return drafts;
  });
  const [amazonTagError, setAmazonTagError] = useState<string | null>(null);
  const [longDescriptionExpanded, setLongDescriptionExpanded] = useState(false);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const splitLayout = typeof children === "function";
  const basicsFormId = splitLayout ? ADMIN_PRODUCT_FORM_ID : undefined;

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
          rawProductUrl: "",
          externalProductId: "",
          trackingTag: "",
          platforms: emptyAmazonPlatformLinks(),
        }),
        ...patch,
      },
    }));
  }

  function updateAmazonPlatformUrl(
    marketplaceId: string,
    platform: SocialPlatform,
    affiliateUrl: string,
  ) {
    const draft = amazonDrafts[marketplaceId];
    updateAmazonDraft(marketplaceId, {
      platforms: {
        ...(draft?.platforms ?? emptyAmazonPlatformLinks()),
        [platform]: affiliateUrl,
      },
    });
  }

  function applyAmazonTracking(marketplaceId: string) {
    setAmazonTagError(null);
    const draft = amazonDrafts[marketplaceId] ?? {
      rawProductUrl: "",
      externalProductId: "",
      trackingTag: "",
      platforms: emptyAmazonPlatformLinks(),
    };
    const sourceUrl =
      AMAZON_HOP_PLATFORMS.map((platform) => draft.platforms[platform]).find((url) => url.trim()) ??
      draft.rawProductUrl;

    const missing = AMAZON_HOP_PLATFORMS.filter(
      (platform) => !resolveAmazonAssociatesTagForPlatform(platform, platformTags, amazonAssociatesTag),
    );
    if (missing.length > 0) {
      setAmazonTagError(
        `Set AMAZON_ASSOCIATES_TAG_${missing.join(" / AMAZON_ASSOCIATES_TAG_")} in .env (or AMAZON_ASSOCIATES_TAG fallback), then restart the app.`,
      );
      return;
    }

    try {
      let trackingTag = draft.trackingTag;
      const platforms = { ...draft.platforms };
      let externalProductId = draft.externalProductId;
      let rawProductUrl = draft.rawProductUrl;

      for (const platform of AMAZON_HOP_PLATFORMS) {
        const partnerTag = resolveAmazonAssociatesTagForPlatform(
          platform,
          platformTags,
          amazonAssociatesTag,
        )!;
        const generated = generateAmazonTrackedAffiliate({
          affiliateUrl: platforms[platform] || sourceUrl,
          rawProductUrl: draft.rawProductUrl || sourceUrl,
          asin: draft.externalProductId,
          partnerTag,
          productId: defaultValues.id,
          customId: trackingTag,
        });
        platforms[platform] = generated.affiliateUrl;
        trackingTag = generated.trackingTag;
        externalProductId = generated.asin ?? externalProductId;
        rawProductUrl = rawProductUrl || generated.affiliateUrl.split("?")[0] || rawProductUrl;
      }

      updateAmazonDraft(marketplaceId, {
        platforms,
        trackingTag,
        externalProductId,
        rawProductUrl,
      });
    } catch (error) {
      setAmazonTagError(error instanceof Error ? error.message : "Could not apply tracking tags.");
    }
  }

  const basics = (
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
              form={basicsFormId}
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
              form={basicsFormId}
              required
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">Public URL: /products/{slug || "…"}</p>
            {defaultValues.publicId != null ? (
              <p className="text-xs text-muted-foreground">
                Instagram short URL: /p/{defaultValues.publicId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                name="brand"
                form={basicsFormId}
                required
                defaultValue={defaultValues.brand}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modelNumber">Model</Label>
              <Input
                id="modelNumber"
                name="modelNumber"
                form={basicsFormId}
                defaultValue={defaultValues.modelNumber}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gtin">GTIN / UPC / EAN</Label>
              <Input id="gtin" name="gtin" form={basicsFormId} defaultValue={defaultValues.gtin} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mpn">MPN</Label>
              <Input id="mpn" name="mpn" form={basicsFormId} defaultValue={defaultValues.mpn} />
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
            <Textarea
              id="shortDescription"
              name="shortDescription"
              form={basicsFormId}
              rows={2}
              required
              defaultValue={defaultValues.shortDescription}
            />
            <p className="text-xs text-muted-foreground">Shown on product cards and search results.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="longDescription">Long description</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                aria-expanded={longDescriptionExpanded}
                onClick={() => setLongDescriptionExpanded((value) => !value)}
              >
                {longDescriptionExpanded ? (
                  <>
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    Expand
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="longDescription"
              name="longDescription"
              form={basicsFormId}
              rows={6}
              required
              defaultValue={defaultValues.longDescription}
              className={cn(
                "field-sizing-fixed resize-y overflow-y-auto",
                longDescriptionExpanded ? "min-h-64 max-h-[32rem]" : "h-36 max-h-36",
              )}
            />
          </div>
        </CardContent>
      </Card>
  );

  const fields = (
    <form
      id={splitLayout ? ADMIN_PRODUCT_FORM_ID : undefined}
      action={formAction}
      className="flex flex-col gap-6"
    >
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

      {splitLayout ? null : basics}

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
            Amazon needs four hop affiliate URLs (Instagram, Facebook, YouTube, TikTok) — one Associates
            tracking ID per platform. Prefer Import / Add eBay offer for eBay so seller and tracking stay in
            sync.
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

                {isAmazon && amazonDraft ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`link_${marketplace.id}_rawProductUrl`} className="text-xs">
                          Raw product URL
                        </Label>
                        <Input
                          id={`link_${marketplace.id}_rawProductUrl`}
                          name={`link_${marketplace.id}_rawProductUrl`}
                          value={amazonDraft.rawProductUrl}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateAmazonDraft(marketplace.id, { rawProductUrl: event.target.value })
                          }
                          placeholder="https://www.amazon.com/dp/B0…"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`link_${marketplace.id}_externalProductId`} className="text-xs">
                          ASIN (auto from URL if blank)
                        </Label>
                        <Input
                          id={`link_${marketplace.id}_externalProductId`}
                          name={`link_${marketplace.id}_externalProductId`}
                          placeholder="B0XXXXXXXX"
                          value={amazonDraft.externalProductId}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateAmazonDraft(marketplace.id, {
                              externalProductId: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`link_${marketplace.id}_trackingTag`} className="text-xs">
                          Product tracking ID (ascsubtag)
                        </Label>
                        <Input
                          id={`link_${marketplace.id}_trackingTag`}
                          name={`link_${marketplace.id}_trackingTag`}
                          placeholder="radarcut-product-… (unique per product)"
                          value={amazonDraft.trackingTag}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateAmazonDraft(marketplace.id, { trackingTag: event.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Each platform URL uses its Associates store tag (e.g. radarcut-ig-20); the product
                        tracking ID is shared for reports.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyAmazonTracking(marketplace.id)}
                      >
                        Generate platform links
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {AMAZON_HOP_PLATFORMS.map((platform) => {
                        const tag = resolveAmazonAssociatesTagForPlatform(
                          platform,
                          platformTags,
                          amazonAssociatesTag,
                        );
                        return (
                          <div key={platform} className="flex flex-col gap-1.5">
                            <Label
                              htmlFor={`link_${marketplace.id}_${platform}_affiliateUrl`}
                              className="text-xs"
                            >
                              {SOCIAL_PLATFORM_LABELS[platform]} hop URL
                              {tag ? ` (tag=${tag})` : ""}
                            </Label>
                            <Input
                              id={`link_${marketplace.id}_${platform}_affiliateUrl`}
                              name={`link_${marketplace.id}_${platform}_affiliateUrl`}
                              value={amazonDraft.platforms[platform]}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                updateAmazonPlatformUrl(marketplace.id, platform, event.target.value)
                              }
                              placeholder="https://www.amazon.com/dp/B0…?tag=…"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`link_${marketplace.id}_affiliateUrl`} className="text-xs">
                        Affiliate URL (leave blank to skip)
                      </Label>
                      <Input
                        id={`link_${marketplace.id}_affiliateUrl`}
                        name={`link_${marketplace.id}_affiliateUrl`}
                        placeholder={`https://www.${marketplace.code.toLowerCase()}.com/...`}
                        defaultValue={link.affiliateUrl}
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
                          defaultValue={link.rawProductUrl}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`link_${marketplace.id}_externalProductId`} className="text-xs">
                          External product ID
                        </Label>
                        <Input
                          id={`link_${marketplace.id}_externalProductId`}
                          name={`link_${marketplace.id}_externalProductId`}
                          defaultValue={link.externalProductId}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`link_${marketplace.id}_trackingTag`} className="text-xs">
                          Tracking tag
                        </Label>
                        <Input
                          id={`link_${marketplace.id}_trackingTag`}
                          name={`link_${marketplace.id}_trackingTag`}
                          defaultValue={link.trackingTag}
                        />
                      </div>
                    </div>
                  </>
                )}

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

  if (children) {
    return <>{children({ basics, fields })}</>;
  }

  return fields;
}
