"use client";

import { useActionState, useState } from "react";
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
import { saveProductAction, type ProductActionState } from "@/server/actions/product.actions";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export interface ProductFormLinkValues {
  affiliateUrl: string;
  rawProductUrl: string;
  externalProductId: string;
  trackingTag: string;
  isActive: boolean;
}

export interface ProductFormValues {
  id?: string;
  title: string;
  slug: string;
  brand: string;
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
  links: Record<string, ProductFormLinkValues>;
}

const emptyLink: ProductFormLinkValues = {
  affiliateUrl: "",
  rawProductUrl: "",
  externalProductId: "",
  trackingTag: "",
  isActive: true,
};

export const emptyProductFormValues: ProductFormValues = {
  title: "",
  slug: "",
  brand: "",
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
  links: {},
};

interface ProductFormProps {
  defaultValues?: ProductFormValues;
  categories: Array<{ id: string; name: string }>;
  marketplaces: Array<{ id: string; code: string; name: string }>;
}

const initialState: ProductActionState = {};

export function ProductForm({ defaultValues = emptyProductFormValues, categories, marketplaces }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);
  const [slug, setSlug] = useState(defaultValues.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.id));
  const [status, setStatus] = useState(defaultValues.status);
  const [categoryId, setCategoryId] = useState(defaultValues.categoryId || categories[0]?.id || "");
  const router = useRouter();

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {defaultValues.id ? <input type="hidden" name="productId" value={defaultValues.id} /> : null}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="categoryId" value={categoryId} />

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
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
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId || undefined} onValueChange={(value) => setCategoryId(value ?? "")}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
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
          <CardTitle className="text-base">Affiliate links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {marketplaces.map((marketplace) => {
            const link = defaultValues.links[marketplace.id] ?? emptyLink;
            return (
              <div key={marketplace.id} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{marketplace.name}</p>
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`link_${marketplace.id}_affiliateUrl`} className="text-xs">
                    Affiliate URL (leave blank to remove this marketplace)
                  </Label>
                  <Input
                    id={`link_${marketplace.id}_affiliateUrl`}
                    name={`link_${marketplace.id}_affiliateUrl`}
                    placeholder={`https://www.${marketplace.code.toLowerCase()}.com/dp/...?tag=your-tag`}
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
                      External product ID (e.g. ASIN)
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
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : defaultValues.id ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
