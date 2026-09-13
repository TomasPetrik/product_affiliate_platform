import { z } from "zod";

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
  brand: z.string().trim().max(100).optional().or(z.literal("")),
  categoryId: z.string().trim().optional().or(z.literal("")),
  shortDescription: z.string().trim().max(300).optional().or(z.literal("")),
  longDescription: z.string().trim().max(5000).optional().or(z.literal("")),
  status: z.enum(productStatusValues),
  isFeatured: z.boolean(),
  isTrending: z.boolean(),
  currency: z.string().trim().length(3, "Use a 3-letter currency code, e.g. USD").toUpperCase(),
  displayPrice: z.coerce.number().min(0).max(999999).optional().nullable(),
  originalPrice: z.coerce.number().min(0).max(999999).optional().nullable(),
  seoTitle: z.string().trim().max(150).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(300).optional().or(z.literal("")),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const affiliateLinkSchema = z.object({
  marketplaceId: z.string().min(1),
  affiliateUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  rawProductUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  externalProductId: z.string().trim().max(200).optional().or(z.literal("")),
  trackingTag: z.string().trim().max(100).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type AffiliateLinkFormValues = z.infer<typeof affiliateLinkSchema>;
