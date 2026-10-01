import {
  DEFAULT_AMAZON_OFFER_PREFERENCE,
  type AmazonOfferPreferenceFlags,
} from "@/lib/amazon-offer-preference";
import { prisma } from "@/lib/prisma";

const SITE_SETTING_KEY = "default";

export type SiteSettings = AmazonOfferPreferenceFlags;

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: SITE_SETTING_KEY },
    select: {
      preferAmazonWhenCheapest: true,
      forceAmazonOnly: true,
    },
  });

  if (!row) {
    return { ...DEFAULT_AMAZON_OFFER_PREFERENCE };
  }

  return {
    preferAmazonWhenCheapest: row.preferAmazonWhenCheapest,
    forceAmazonOnly: row.forceAmazonOnly,
  };
}

export async function updateSiteSettings(input: SiteSettings): Promise<SiteSettings> {
  const row = await prisma.siteSetting.upsert({
    where: { key: SITE_SETTING_KEY },
    create: {
      key: SITE_SETTING_KEY,
      preferAmazonWhenCheapest: input.preferAmazonWhenCheapest,
      forceAmazonOnly: input.forceAmazonOnly,
    },
    update: {
      preferAmazonWhenCheapest: input.preferAmazonWhenCheapest,
      forceAmazonOnly: input.forceAmazonOnly,
    },
    select: {
      preferAmazonWhenCheapest: true,
      forceAmazonOnly: true,
    },
  });

  return {
    preferAmazonWhenCheapest: row.preferAmazonWhenCheapest,
    forceAmazonOnly: row.forceAmazonOnly,
  };
}
