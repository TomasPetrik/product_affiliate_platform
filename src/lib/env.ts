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
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
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
