"use client";

import { useMemo, useState, useTransition } from "react";
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
import { formatCurrency } from "@/lib/format";
import { slugify } from "@/lib/slug";
import {
  fetchEbayListingAction,
  importEbayProductAction,
  searchCatalogProductsAction,
  searchEbayAction,
  type EbayPreviewView,
  type EbaySearchHitView,
} from "@/server/actions/ebay-import.actions";

interface CategoryOption {
  id: string;
  name: string;
  parent: { name: string } | null;
}

interface EbayImportFormProps {
  categories: CategoryOption[];
  attachProductId?: string;
  attachProductTitle?: string;
  sandbox?: boolean;
}

type Mode = "create" | "attach";

function categoryLabel(category: CategoryOption): string {
  return category.parent ? `${category.parent.name} / ${category.name}` : category.name;
}

export function EbayImportForm({
  categories,
  attachProductId,
  attachProductTitle,
  sandbox = false,
}: EbayImportFormProps) {
  const router = useRouter();
  const lockedAttach = Boolean(attachProductId);
  const [source, setSource] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<EbaySearchHitView[]>([]);
  const [preview, setPreview] = useState<EbayPreviewView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [brand, setBrand] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [gtin, setGtin] = useState("");
  const [mpn, setMpn] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("PUBLISHED");
  const [isFeatured, setIsFeatured] = useState(false);
  const [mode, setMode] = useState<Mode>(lockedAttach ? "attach" : "create");
  const [selectedProductId, setSelectedProductId] = useState(attachProductId ?? "");
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<Array<{ id: string; title: string; slug: string; brand: string }>>([]);

  function applyPreview(next: EbayPreviewView) {
    setPreview(next);
    setTitle(next.title);
    setSlug(next.suggestedSlug);
    setBrand(next.brand || "Unknown");
    setModelNumber(next.modelNumber);
    setGtin(next.gtin);
    setMpn(next.mpn);
    setShortDescription(next.shortDescription.slice(0, 300));
    setLongDescription(next.description.slice(0, 5000));
    if (lockedAttach) {
      setMode("attach");
      setSelectedProductId(attachProductId ?? "");
    } else if (next.existingOffer) {
      setMode("attach");
      setSelectedProductId(next.existingOffer.productId);
    } else if (next.identifierMatches[0]) {
      setMode("attach");
      setSelectedProductId(next.identifierMatches[0].id);
    } else {
      setMode("create");
      setSelectedProductId("");
    }
  }

  function fetchListing(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await fetchEbayListingAction(value, attachProductId);
      if (result.error || !result.preview) {
        setPreview(null);
        setError(result.error ?? "Could not fetch that listing.");
        return;
      }
      applyPreview(result.preview);
    });
  }

  const matchHint = useMemo(() => {
    if (!preview) return null;
    if (preview.existingOffer) {
      return `This eBay listing is already attached to “${preview.existingOffer.productTitle}”. Importing will refresh that offer.`;
    }
    if (preview.identifierMatches.length > 0) {
      return "A RadarCut product matched a strong identifier (GTIN/MPN/brand+model). Attach rather than creating a duplicate unless you are sure they are different products.";
    }
    return "No strong identifier match. Create a new product, or attach to an existing one.";
  }, [preview]);

  return (
    <div className="flex flex-col gap-6">
      {sandbox ? (
        <Alert>
          <AlertDescription>
            Using the eBay <span className="font-medium">sandbox</span>. Search here instead of pasting a live
            ebay.com URL — sandbox credentials only see sandbox listings. Affiliate tracking uses a test URL
            until you set a production ePN campaign ID.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import eBay listing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ebay-url">eBay URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="ebay-url"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder={sandbox ? "https://sandbox.ebay.com/itm/123456789" : "https://www.ebay.com/itm/123456789"}
              />
              <Button type="button" onClick={() => fetchListing(source)} disabled={pending || !source.trim()}>
                {pending ? "Fetching…" : "Fetch product"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search eBay</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sony WH-1000XM5"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setError(null);
                  startTransition(async () => {
                    const result = await searchEbayAction(query);
                    if (result.error) {
                      setHits([]);
                      setError(result.error);
                      return;
                    }
                    setHits(result.hits ?? []);
                  });
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || query.trim().length < 2}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await searchEbayAction(query);
                  if (result.error) {
                    setHits([]);
                    setError(result.error);
                    return;
                  }
                  setHits(result.hits ?? []);
                });
              }}
            >
              Search
            </Button>
          </div>

          {hits.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {hits.map((hit) => (
                <li key={hit.itemId} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                  {hit.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hit.imageUrl} alt="" className="h-16 w-16 rounded-md object-contain bg-muted" />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{hit.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {hit.price != null && hit.currency ? formatCurrency(hit.price, hit.currency) : "Price on eBay"}
                      {hit.condition ? ` · ${hit.condition}` : ""}
                      {hit.sellerName ? ` · Seller: ${hit.sellerName}` : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" disabled={pending} onClick={() => fetchListing(hit.itemId)}>
                    Import
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {matchHint ? <p className="text-sm text-muted-foreground">{matchHint}</p> : null}

            <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
              {preview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.imageUrl}
                  alt={preview.title}
                  className="h-40 w-full rounded-lg border bg-muted object-contain"
                />
              ) : (
                <div className="h-40 rounded-lg border bg-muted" />
              )}
              <div className="grid gap-3 text-sm">
                <p>
                  <span className="text-muted-foreground">eBay item ID:</span> {preview.itemId}
                </p>
                <p>
                  <span className="text-muted-foreground">Price:</span>{" "}
                  {formatCurrency(preview.price, preview.currency)}
                  {preview.originalPrice
                    ? ` (was ${formatCurrency(preview.originalPrice, preview.currency)})`
                    : ""}
                </p>
                <p>
                  <span className="text-muted-foreground">Condition:</span> {preview.condition ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Seller:</span> {preview.sellerName ?? "—"}
                </p>
                <p className="truncate">
                  <span className="text-muted-foreground">Affiliate URL:</span> generated automatically
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>RadarCut product</Label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    checked={mode === "create"}
                    disabled={lockedAttach}
                    onChange={() => setMode("create")}
                  />
                  Create new product
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    checked={mode === "attach"}
                    onChange={() => setMode("attach")}
                  />
                  Attach to existing product
                </label>
              </div>
            </div>

            {mode === "attach" ? (
              <div className="flex flex-col gap-2">
                {lockedAttach ? (
                  <p className="text-sm">
                    Attaching to <span className="font-medium">{attachProductTitle}</span>
                  </p>
                ) : (
                  <>
                    {preview.identifierMatches.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <Label>Suggested matches</Label>
                        {preview.identifierMatches.map((match) => (
                          <label key={match.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="attachProduct"
                              checked={selectedProductId === match.id}
                              onChange={() => setSelectedProductId(match.id)}
                            />
                            {match.title} ({match.reason.replace("_", " + ")})
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <Label htmlFor="product-search">Find a product</Label>
                    <div className="flex gap-2">
                      <Input
                        id="product-search"
                        value={productQuery}
                        onChange={(event) => setProductQuery(event.target.value)}
                        placeholder="Search RadarCut products"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await searchCatalogProductsAction(productQuery);
                            setProductHits(result.products);
                          });
                        }}
                      >
                        Find
                      </Button>
                    </div>
                    {productHits.map((product) => (
                      <label key={product.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="attachProduct"
                          checked={selectedProductId === product.id}
                          onChange={() => setSelectedProductId(product.id)}
                        />
                        {product.title}
                      </label>
                    ))}
                  </>
                )}
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="title">Product name</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setSlug(slugify(event.target.value));
                  }}
                />
              </div>
              {mode === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" value={brand} onChange={(event) => setBrand(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modelNumber">Model</Label>
                <Input id="modelNumber" value={modelNumber} onChange={(event) => setModelNumber(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gtin">GTIN / UPC / EAN</Label>
                <Input id="gtin" value={gtin} onChange={(event) => setGtin(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mpn">MPN</Label>
                <Input id="mpn" value={mpn} onChange={(event) => setMpn(event.target.value)} />
              </div>
              {mode === "create" ? (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId || undefined} onValueChange={(value) => setCategoryId(value ?? "")}>
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="Select a RadarCut category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {categoryLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  eBay categories are not copied. Choose a RadarCut category.
                </p>
              </div>
              ) : null}
              {mode === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                    <SelectTrigger id="status" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shortDescription">Short description</Label>
              <Textarea
                id="shortDescription"
                rows={2}
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="longDescription">Description</Label>
              <Textarea
                id="longDescription"
                rows={6}
                value={longDescription}
                onChange={(event) => setLongDescription(event.target.value)}
              />
            </div>

            {mode === "create" ? (
              <div className="flex items-center gap-2">
                <Switch id="isFeatured" checked={isFeatured} onCheckedChange={setIsFeatured} />
                <Label htmlFor="isFeatured">Featured</Label>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || (mode === "create" && !categoryId) || (mode === "attach" && !selectedProductId)}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await importEbayProductAction({
                      itemId: preview.itemId,
                      mode,
                      attachProductId: mode === "attach" ? selectedProductId : "",
                      categoryId,
                      title,
                      slug,
                      brand,
                      modelNumber,
                      gtin,
                      mpn,
                      shortDescription,
                      longDescription,
                      status,
                      isFeatured,
                    });
                    if (result.error || !result.productId) {
                      setError(result.error ?? "Import failed.");
                      return;
                    }
                    router.push(`/admin/products/${result.productId}/edit`);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Importing…" : "Import product"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
