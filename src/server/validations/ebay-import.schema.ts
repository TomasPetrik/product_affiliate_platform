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
    itemId: z.string().regex(/^\d{6,19}$/, "Invalid eBay item ID"),
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
    longDescription: z.string().trim().min(1).max(5000),
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

export const retailerOfferManualSchema = z.object({
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
  isActive: z.boolean(),
  isPrimary: z.boolean(),
});
