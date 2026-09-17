import { getAdminSession } from "@/lib/auth";
import { isExcludedAnalyticsVisitor, parseExcludedCountries, parseExcludedIps } from "@/lib/analytics-exclude";
import { env } from "@/lib/env";

export async function shouldOmitAnalytics(visitor: {
  ip?: string | null;
  country?: string | null;
}): Promise<boolean> {
  if (
    isExcludedAnalyticsVisitor(visitor, {
      ips: parseExcludedIps(env.ANALYTICS_EXCLUDE_IPS),
      countries: parseExcludedCountries(env.ANALYTICS_EXCLUDE_COUNTRIES),
    })
  ) {
    return true;
  }

  return Boolean(await getAdminSession());
}
