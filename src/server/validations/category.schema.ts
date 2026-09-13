import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters")
    .max(100)
    .regex(slugPattern, "Slug can only contain lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
