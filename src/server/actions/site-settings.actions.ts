"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/server/services/audit.service";
import { revalidateAffiliateRedirectCache, revalidatePublicCatalog } from "@/server/services/revalidate";
import { getSiteSettings, updateSiteSettings } from "@/server/services/site-settings.service";

export interface SiteSettingsActionState {
  error?: string;
  success?: boolean;
  preferAmazonWhenCheapest?: boolean;
  forceAmazonOnly?: boolean;
}

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

export async function updateAmazonOfferSettingsAction(
  _prevState: SiteSettingsActionState,
  formData: FormData,
): Promise<SiteSettingsActionState> {
  const actor = await requireAdminSession();
  const before = await getSiteSettings();

  const preferAmazonWhenCheapest = parseBool(formData.get("preferAmazonWhenCheapest"));
  const forceAmazonOnly = parseBool(formData.get("forceAmazonOnly"));

  const after = await updateSiteSettings({
    preferAmazonWhenCheapest,
    forceAmazonOnly,
  });

  await writeAuditLog({
    actor,
    action: "site_settings.update",
    entityType: "SiteSetting",
    entityId: "default",
    before,
    after,
  });

  revalidatePath("/admin/settings");
  revalidatePublicCatalog();
  revalidateAffiliateRedirectCache();

  return {
    success: true,
    preferAmazonWhenCheapest: after.preferAmazonWhenCheapest,
    forceAmazonOnly: after.forceAmazonOnly,
  };
}
