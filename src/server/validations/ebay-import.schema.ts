import { z } from "zod";

import { isHttpUrl } from "@/lib/approved-image-url";

export const ebaySearchSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters").max(200),
});

export const ebayFetchSchema = z.object({
  source: z.string().trim().min(6, "Paste an eBay URL or item ID").max(500),
  productId: z.string().trim().max(64).optional().or(z.literal("")),
});

export const ebayImportSchema = z
  .object({
    itemId: z
      .string()
      .trim()
      .refine(
        (value) => /^\d{6,19}$/.test(value) || /^v1\|[^|]+\|[^|]+$/.test(value),
        "Invalid eBay item ID",
      ),
    mode: z.enum(["create", "attach"]),
    attachProductId: z.string().trim().max(64).optional().or(z.literal("")),
    categoryId: z.string().trim().optional().or(z.literal("")),
    title: z.string().trim().min(2).max(200),
    slug: z.string().trim().max(200).optional().or(z.literal("")),
    brand: z.string().trim().min(1).max(100),
    modelNumber: z.string().trim().max(100).optional().or(z.literal("")),
    gtin: z.string().trim().max(20).optional().or(z.literal("")),
    mpn: z.string().trim().max(80).optional().or(z.literal("")),
    shortDescription: z.string().trim().min(1).max(300),
    longDescription: z.string().trim().min(1).max(50_000, "Long description must be at most 50,000 characters"),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    isFeatured: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "create" && !value.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Category is required" });
    }
    if (value.mode === "attach" && !value.attachProductId) {
      ctx.addIssue({ code: "custom", path: ["attachProductId"], message: "Select an existing product" });
    }
  });

const optionalMoney = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return value;
}, z.coerce.number().min(0).max(999999).nullable());

export const retailerOfferManualSchema = z
  .object({
    affiliateUrl: z
      .string()
      .trim()
      .min(1, "Affiliate URL is required")
      .max(2000)
      .refine(isHttpUrl, "Affiliate URL must be a valid http(s) URL"),
    rawProductUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || isHttpUrl(value), "Product URL must be a valid http(s) URL"),
    trackingTag: z.string().trim().max(256).optional().or(z.literal("")),
    lastKnownPrice: optionalMoney,
    lastKnownOriginalPrice: optionalMoney,
    lastKnownPriceCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .max(3)
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || value.length === 3, "Use a 3-letter currency code, e.g. USD"),
    lastKnownAvailability: z
      .enum(["IN_STOCK", "OUT_OF_STOCK", "LIMITED_QUANTITY", ""])
      .optional()
      .or(z.literal("")),
    isActive: z.boolean(),
    isPrimary: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.lastKnownOriginalPrice != null && value.lastKnownPrice == null) {
      ctx.addIssue({
        code: "custom",
        path: ["lastKnownPrice"],
        message: "Set the offer price when providing an original price",
      });
    }
  });
