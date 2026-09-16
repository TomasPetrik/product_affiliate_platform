import { z } from "zod";

import { isApprovedImageUrl, isHttpUrl } from "@/lib/approved-image-url";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productStatusValues = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const productSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters")
    .max(200)
    .regex(slugPattern, "Slug can only contain lowercase letters, numbers and hyphens"),
  brand: z.string().trim().min(1, "Brand is required").max(100),
  modelNumber: z.string().trim().max(100).optional().or(z.literal("")),
  gtin: z.string().trim().max(20).optional().or(z.literal("")),
  mpn: z.string().trim().max(80).optional().or(z.literal("")),
  categoryId: z.string().trim().min(1, "Category is required"),
  shortDescription: z.string().trim().min(1, "Short description is required").max(300),
  longDescription: z.string().trim().min(1, "Long description is required").max(5000),
  status: z.enum(productStatusValues),
  isFeatured: z.boolean(),
  isTrending: z.boolean(),
  currency: z.string().trim().length(3, "Use a 3-letter currency code, e.g. USD").toUpperCase(),
  displayPrice: z.coerce.number().min(0, "Display price is required").max(999999),
  originalPrice: z.coerce.number().min(0).max(999999).optional().nullable(),
  seoTitle: z.string().trim().max(150).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(300).optional().or(z.literal("")),
  ogImageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || isApprovedImageUrl(value), "OG image must be an https URL or an uploaded image"),
});

export type ProductFormValues = z.infer<typeof productSchema>;

const optionalMoney = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return value;
}, z.coerce.number().min(0).max(999999).nullable());

export const affiliateLinkSchema = z
  .object({
    marketplaceId: z.string().min(1),
    affiliateUrl: z.string().trim().max(2000).optional().or(z.literal("")),
    rawProductUrl: z.string().trim().max(2000).optional().or(z.literal("")),
    externalProductId: z.string().trim().max(200).optional().or(z.literal("")),
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
  })
  .superRefine((value, ctx) => {
    const url = value.affiliateUrl ?? "";
    const raw = value.rawProductUrl ?? "";
    const hasListing = url.length > 0 || raw.length > 0 || Boolean(value.externalProductId);

    if (url && !isHttpUrl(url)) {
      ctx.addIssue({
        code: "custom",
        path: ["affiliateUrl"],
        message: "Affiliate URL must be a valid http(s) URL",
      });
    }

    if (raw && !isHttpUrl(raw)) {
      ctx.addIssue({
        code: "custom",
        path: ["rawProductUrl"],
        message: "Raw product URL must be a valid http(s) URL",
      });
    }

    if (hasListing && !url) {
      ctx.addIssue({
        code: "custom",
        path: ["affiliateUrl"],
        message: "Affiliate URL is required when adding a marketplace listing",
      });
    }

    if (value.lastKnownOriginalPrice != null && value.lastKnownPrice == null) {
      ctx.addIssue({
        code: "custom",
        path: ["lastKnownPrice"],
        message: "Set the offer price when providing an original price",
      });
    }
  });

export type AffiliateLinkFormValues = z.infer<typeof affiliateLinkSchema>;

export const productImageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Image URL is required")
    .max(2000)
    .refine(isApprovedImageUrl, "Use an https image URL or upload a file"),
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  isPrimary: z.boolean(),
});

export type ProductImageFormValues = z.infer<typeof productImageSchema>;
