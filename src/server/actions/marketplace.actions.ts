"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { updateMarketplace } from "@/server/services/marketplace.service";
import { revalidateAffiliateRedirectCache } from "@/server/services/revalidate";
import { marketplaceUpdateSchema } from "@/server/validations/marketplace.schema";

export interface MarketplaceActionState {
  error?: string;
  success?: boolean;
}

export async function updateMarketplaceAction(
  _prevState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const actor = await requireAdminSession();
  const parsed = marketplaceUpdateSchema.safeParse({
    marketplaceId: formData.get("marketplaceId"),
    name: formData.get("name"),
    baseUrl: formData.get("baseUrl"),
    logoUrl: formData.get("logoUrl") || "",
    isActive: formData.get("isActive") || "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid marketplace details." };
  }

  const marketplace = await updateMarketplace(parsed.data.marketplaceId, {
    name: parsed.data.name,
    baseUrl: parsed.data.baseUrl,
    logoUrl: parsed.data.logoUrl || null,
    isActive: parsed.data.isActive,
  });

  await writeAuditLog({
    actor,
    action: "marketplace.update",
    entityType: "Marketplace",
    entityId: marketplace.id,
    after: parsed.data,
  });

  revalidatePath("/admin/marketplaces");
  revalidatePath("/admin/settings");
  revalidateAffiliateRedirectCache();
  return { success: true };
}
