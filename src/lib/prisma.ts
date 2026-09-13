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
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
