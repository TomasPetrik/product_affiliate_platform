import { z } from "zod";

export const marketplaceUpdateSchema = z.object({
  marketplaceId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(80),
  baseUrl: z.string().trim().url("Enter a valid URL"),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});
