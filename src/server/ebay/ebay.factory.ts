import { env } from "@/lib/env";
import { EbayServiceError } from "@/server/ebay/ebay-errors";
import { createEbayService, type EbayService } from "@/server/ebay/ebay.service";
import type { EbayClientConfig } from "@/server/ebay/ebay.client";

export function getEbayConfigFromEnv(): EbayClientConfig {
  const sandbox = env.EBAY_ENVIRONMENT === "sandbox";
  const clientId = sandbox
    ? env.EBAY_SANDBOX_CLIENT_ID ?? env.EBAY_CLIENT_ID
    : env.EBAY_PRODUCTION_CLIENT_ID ?? env.EBAY_CLIENT_ID;
  const clientSecret = sandbox
    ? env.EBAY_SANDBOX_CLIENT_SECRET ?? env.EBAY_CLIENT_SECRET
    : env.EBAY_PRODUCTION_CLIENT_SECRET ?? env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new EbayServiceError(
      "NOT_CONFIGURED",
      sandbox
        ? "eBay sandbox is not configured. Set EBAY_SANDBOX_CLIENT_ID and EBAY_SANDBOX_CLIENT_SECRET."
        : "eBay production is not configured. Set EBAY_PRODUCTION_CLIENT_ID and EBAY_PRODUCTION_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    marketplaceId: env.EBAY_MARKETPLACE_ID,
    environment: env.EBAY_ENVIRONMENT,
    affiliateCampaignId: env.EBAY_AFFILIATE_CAMPAIGN_ID,
  };
}

let singleton: { key: string; service: EbayService } | null = null;

export function getEbayService(): EbayService {
  const config = getEbayConfigFromEnv();
  const key = `${config.environment}:${config.clientId}:${config.affiliateCampaignId ?? ""}`;
  if (!singleton || singleton.key !== key) {
    singleton = { key, service: createEbayService(config) };
  }
  return singleton.service;
}
