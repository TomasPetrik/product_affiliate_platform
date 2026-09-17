import "dotenv/config";

import { parseExcludedIps } from "@/lib/analytics-exclude";
import { env } from "@/lib/env";
import { purgeAnalyticsForIps } from "@/server/services/tracking.service";

async function main() {
  const ips = parseExcludedIps(env.ANALYTICS_EXCLUDE_IPS);
  if (ips.size === 0) {
    console.log("No ANALYTICS_EXCLUDE_IPS configured. Nothing to purge.");
    return;
  }

  const result = await purgeAnalyticsForIps([...ips]);
  console.log(
    `Purged excluded analytics: ${result.sessions} sessions, ${result.events} events, ${result.views} product views, ${result.clicks} clicks.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
