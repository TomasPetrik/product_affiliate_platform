import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Prisma 7 requires an explicit driver adapter — there is no longer an
 * embedded database driver. We use `@prisma/adapter-pg` (node-postgres) for
 * PostgreSQL.
 *
 * Next.js hot-reloads server modules in development, which would otherwise
 * create a new `PrismaClient` (and a new connection pool) on every edit. We
 * stash the instance on `globalThis` so dev reloads reuse the same client.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Conservative pool size: keeps us well within typical connection limits
  // on managed Postgres free/hobby tiers (and the local `prisma dev`
  // server, capped at 10 total connections) even when multiple server
  // processes/workers each hold their own pool. Tune upward for a
  // dedicated production database with headroom.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 5 });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
