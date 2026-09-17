import { z } from "zod";

/**
 * Centralized, validated access to environment variables.
 *
 * Import `env` instead of reading `process.env` directly anywhere in the
 * app. This gives us a single source of truth, fails fast (at startup) with
 * a readable error if a required variable is missing/malformed, and keeps
 * TypeScript aware of exactly which variables exist.
 *
 * Add new variables here as later phases introduce them (NextAuth secrets,
 * marketplace API keys, cron secrets, etc.) rather than reading
 * `process.env` ad hoc in feature code.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** PostgreSQL connection string consumed by Prisma. */
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string",
    ),

  /** Public base URL of the site, used for canonical/OG metadata and sitemaps. */
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),

  /** Secret used to sign/verify admin session cookies (see src/lib/session.ts). */
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters — generate one with `openssl rand -base64 32`"),

  /**
   * eBay developer application credentials (Browse API). Optional so the public
   * site still boots without marketplace import configured. Admin import fails
   * with a clear message when these are missing.
   *
   * Prefer environment-specific keysets (`EBAY_SANDBOX_*` / `EBAY_PRODUCTION_*`).
   * The unprefixed `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` remain as a fallback.
   */
  EBAY_CLIENT_ID: z.string().min(1).optional(),
  EBAY_CLIENT_SECRET: z.string().min(1).optional(),
  EBAY_DEV_ID: z.string().min(1).optional(),
  EBAY_SANDBOX_CLIENT_ID: z.string().min(1).optional(),
  EBAY_SANDBOX_CLIENT_SECRET: z.string().min(1).optional(),
  EBAY_SANDBOX_DEV_ID: z.string().min(1).optional(),
  EBAY_PRODUCTION_CLIENT_ID: z.string().min(1).optional(),
  EBAY_PRODUCTION_CLIENT_SECRET: z.string().min(1).optional(),
  EBAY_PRODUCTION_DEV_ID: z.string().min(1).optional(),
  /** eBay Partner Network campaign / campid used to request itemAffiliateWebUrl. */
  EBAY_AFFILIATE_CAMPAIGN_ID: z.string().min(1).optional(),
  /** Browse API marketplace, e.g. EBAY_US. */
  EBAY_MARKETPLACE_ID: z.string().min(1).default("EBAY_US"),
  EBAY_ENVIRONMENT: z.enum(["production", "sandbox"]).default("production"),
  /**
   * Shared secret for eBay's Marketplace Account Deletion challenge (32–80
   * letters, numbers, hyphen, underscore). Optional so the public site still boots.
   */
  EBAY_NOTIFICATION_VERIFICATION_TOKEN: z
    .string()
    .min(32)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "EBAY_NOTIFICATION_VERIFICATION_TOKEN must be 32–80 letters, numbers, hyphen or underscore")
    .optional(),
  /** Exact HTTPS URL registered with eBay. Defaults to {NEXT_PUBLIC_SITE_URL}/api/ebay/marketplace-account-deletion */
  EBAY_NOTIFICATION_ENDPOINT: z.string().url().optional(),

  /**
   * Bearer secret for scheduled jobs (e.g. POST /api/cron/price-sync). Optional so
   * the public site boots without cron configured; the cron route returns 503 when missing.
   */
  CRON_SECRET: z.string().min(16).optional(),

  /**
   * Amazon Associates store ID / partner tag (e.g. radarcut-20). Added as `tag=` on
   * every Amazon affiliate URL for commissions. Per-product attribution uses a
   * unique `ascsubtag` stored on AffiliateLink.trackingTag. Optional so the public
   * site boots without it; the admin “Generate tracking ID” CTA explains when missing.
   */
  AMAZON_ASSOCIATES_TAG: z.string().min(1).optional(),

  /**
   * Days to keep raw analytics_events / product_views. Aggregated daily metrics
   * are kept after purge. Default 400 days.
   */
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).optional().default(400),

  /**
   * Comma-separated public IPs whose visits are not recorded (site operators).
   * Raw IPs are never written to analytics tables; this list is only matched
   * at ingest time.
   */
  ANALYTICS_EXCLUDE_IPS: z.string().optional(),
  /**
   * Comma-separated ISO country codes to omit from analytics, e.g. `SK`.
   * Leave empty to keep real visitors from those countries.
   */
  ANALYTICS_EXCLUDE_COUNTRIES: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    EBAY_CLIENT_ID: blankToUndefined(process.env.EBAY_CLIENT_ID),
    EBAY_CLIENT_SECRET: blankToUndefined(process.env.EBAY_CLIENT_SECRET),
    EBAY_DEV_ID: blankToUndefined(process.env.EBAY_DEV_ID),
    EBAY_SANDBOX_CLIENT_ID: blankToUndefined(process.env.EBAY_SANDBOX_CLIENT_ID),
    EBAY_SANDBOX_CLIENT_SECRET: blankToUndefined(process.env.EBAY_SANDBOX_CLIENT_SECRET),
    EBAY_SANDBOX_DEV_ID: blankToUndefined(process.env.EBAY_SANDBOX_DEV_ID),
    EBAY_PRODUCTION_CLIENT_ID: blankToUndefined(process.env.EBAY_PRODUCTION_CLIENT_ID),
    EBAY_PRODUCTION_CLIENT_SECRET: blankToUndefined(process.env.EBAY_PRODUCTION_CLIENT_SECRET),
    EBAY_PRODUCTION_DEV_ID: blankToUndefined(process.env.EBAY_PRODUCTION_DEV_ID),
    EBAY_AFFILIATE_CAMPAIGN_ID: blankToUndefined(process.env.EBAY_AFFILIATE_CAMPAIGN_ID),
    EBAY_MARKETPLACE_ID: blankToUndefined(process.env.EBAY_MARKETPLACE_ID),
    EBAY_ENVIRONMENT: blankToUndefined(process.env.EBAY_ENVIRONMENT) ?? "production",
    EBAY_NOTIFICATION_VERIFICATION_TOKEN: blankToUndefined(
      process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN,
    ),
    EBAY_NOTIFICATION_ENDPOINT: blankToUndefined(process.env.EBAY_NOTIFICATION_ENDPOINT),
    CRON_SECRET: blankToUndefined(process.env.CRON_SECRET),
    AMAZON_ASSOCIATES_TAG: blankToUndefined(process.env.AMAZON_ASSOCIATES_TAG),
    ANALYTICS_RETENTION_DAYS: blankToUndefined(process.env.ANALYTICS_RETENTION_DAYS),
    ANALYTICS_EXCLUDE_IPS: blankToUndefined(process.env.ANALYTICS_EXCLUDE_IPS),
    ANALYTICS_EXCLUDE_COUNTRIES: blankToUndefined(process.env.ANALYTICS_EXCLUDE_COUNTRIES),
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCheck your .env file against .env.example.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();
