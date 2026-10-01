/**
 * Upserts a dedicated Meta App Review admin account on the current DATABASE_URL.
 *
 * Usage (from app root, with .env loaded):
 *   META_REVIEW_ADMIN_PASSWORD='...' npx tsx scripts/create-meta-review-admin.ts
 *
 * Optional env overrides:
 *   META_REVIEW_ADMIN_EMAIL (default: meta-review@radarcut.com)
 *   META_REVIEW_ADMIN_PASSWORD (random if omitted)
 *   META_REVIEW_ADMIN_NAME (default: Meta Reviewer)
 */
import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const scrypt = promisify(scryptCallback);

async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(plainPassword, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

function randomPassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const email = (process.env.META_REVIEW_ADMIN_EMAIL ?? "meta-review@radarcut.com").toLowerCase();
  const password = process.env.META_REVIEW_ADMIN_PASSWORD ?? randomPassword();
  const name = process.env.META_REVIEW_ADMIN_NAME ?? "Meta Reviewer";
  const demoProductId = process.env.META_REVIEW_PRODUCT_ID ?? "cmu35nqbu000247l24tsike5y";

  const adapter = new PrismaPg({ connectionString: databaseUrl, max: 2 });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.adminUser.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        name,
        role: "ADMIN",
        isActive: true,
      },
      update: {
        passwordHash,
        name,
        role: "ADMIN",
        isActive: true,
      },
    });

    const product = await prisma.product.findUnique({
      where: { id: demoProductId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        marketingVideos: {
          select: {
            id: true,
            title: true,
            posts: {
              select: {
                platform: true,
                externalId: true,
                viewCount: true,
                syncStatus: true,
                permalinkUrl: true,
                lastSyncedAt: true,
              },
            },
          },
        },
      },
    });

    // Meta tables may not exist until the Meta OAuth migration is deployed.
    const metaDelegate = (
      prisma as unknown as {
        metaOAuthConnection?: {
          findUnique: (args: unknown) => Promise<unknown>;
        };
      }
    ).metaOAuthConnection;

    const meta = metaDelegate
      ? await metaDelegate.findUnique({
          where: { key: "default" },
          select: {
            status: true,
            pageName: true,
            pageId: true,
            instagramUsername: true,
            lastSyncedAt: true,
            lastError: true,
          },
        })
      : null;

    console.log(
      JSON.stringify(
        {
          admin: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            password,
          },
          demoProduct: product
            ? {
                ...product,
                marketingVideos: product.marketingVideos.map((video) => ({
                  ...video,
                  posts: video.posts.map((post) => ({
                    ...post,
                    viewCount: post.viewCount.toString(),
                  })),
                })),
              }
            : null,
          metaConnection: meta,
          metaSchemaDeployed: Boolean(metaDelegate),
          loginUrl: "https://radarcut.com/admin/login",
          productUrl: product
            ? `https://radarcut.com/admin/products/${product.id}`
            : null,
          productEditUrl: product
            ? `https://radarcut.com/admin/products/${product.id}/edit`
            : null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
