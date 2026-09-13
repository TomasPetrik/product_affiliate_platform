import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { computeDiscountPercentage } from "@/lib/format";
import { hashPassword } from "@/lib/password";

/**
 * Local development seed data. Run with `npm run db:seed` (also runs
 * automatically after `prisma migrate reset`, since it's wired up as
 * `migrations.seed` in `prisma.config.ts`).
 *
 * Safe to re-run: every write is an upsert keyed on a natural unique field
 * (email/slug/code), so running this repeatedly won't create duplicates.
 */

const categorySeeds = [
  { slug: "home-kitchen", name: "Home & Kitchen", description: "Everyday upgrades for cooking, cleaning and organizing your home.", sortOrder: 0 },
  { slug: "electronics", name: "Electronics", description: "Gadgets, audio and smart devices worth adding to your cart.", sortOrder: 1 },
  { slug: "fitness-outdoors", name: "Fitness & Outdoors", description: "Gear for workouts, running and getting outside.", sortOrder: 2 },
  { slug: "office-productivity", name: "Office & Productivity", description: "Desk setups, organizers and tools for getting things done.", sortOrder: 3 },
  { slug: "pet-supplies", name: "Pet Supplies", description: "Well-reviewed picks for dogs, cats and other companions.", sortOrder: 4 },
];

const marketplaceSeeds = [
  { code: "AMAZON" as const, name: "Amazon", baseUrl: "https://www.amazon.com" },
  { code: "EBAY" as const, name: "eBay", baseUrl: "https://www.ebay.com" },
];

interface ProductSeed {
  slug: string;
  title: string;
  brand: string;
  categorySlug: string;
  shortDescription: string;
  longDescription: string;
  currency: string;
  displayPrice: number;
  originalPrice: number | null;
  rating: number;
  ratingCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  marketplaces: Array<"AMAZON" | "EBAY">;
  publishedAt: string;
}

const productSeeds: ProductSeed[] = [
  {
    slug: "stainless-steel-french-press",
    title: "Stainless Steel French Press, 34oz",
    brand: "Brewmaster",
    categorySlug: "home-kitchen",
    shortDescription: "Double-wall insulated French press that keeps coffee hot for hours.",
    longDescription:
      "A durable, double-wall insulated stainless steel French press built for daily use. Keeps coffee hot for longer than glass alternatives, includes a fine-mesh filter to reduce sediment, and is easy to disassemble for cleaning.",
    currency: "USD",
    displayPrice: 34.99,
    originalPrice: 44.99,
    rating: 4.6,
    ratingCount: 2140,
    isFeatured: true,
    isTrending: true,
    marketplaces: ["AMAZON", "EBAY"],
    publishedAt: "2026-08-01",
  },
  {
    slug: "noise-cancelling-earbuds-pro",
    title: "Wireless Noise-Cancelling Earbuds Pro",
    brand: "SoundCore",
    categorySlug: "electronics",
    shortDescription: "Active noise cancellation with 30-hour battery life and IPX5 rating.",
    longDescription:
      "Compact true-wireless earbuds with active noise cancellation, transparency mode, and a 30-hour combined battery life with the charging case. IPX5 water resistance makes them workout-friendly.",
    currency: "USD",
    displayPrice: 79.0,
    originalPrice: 99.0,
    rating: 4.4,
    ratingCount: 8760,
    isFeatured: true,
    isTrending: true,
    marketplaces: ["AMAZON"],
    publishedAt: "2026-08-05",
  },
  {
    slug: "adjustable-dumbbell-set",
    title: "Adjustable Dumbbell Set, 5–52.5 lbs (Pair)",
    brand: "IronFlex",
    categorySlug: "fitness-outdoors",
    shortDescription: "Space-saving adjustable dumbbells that replace 15 pairs of weights.",
    longDescription:
      "A quick-select adjustable dumbbell pair that replaces a full rack of fixed weights, ranging from 5 to 52.5 lbs per hand. Popular for home gyms with limited space.",
    currency: "USD",
    displayPrice: 349.0,
    originalPrice: 429.0,
    rating: 4.7,
    ratingCount: 3520,
    isFeatured: false,
    isTrending: true,
    marketplaces: ["AMAZON", "EBAY"],
    publishedAt: "2026-07-20",
  },
  {
    slug: "ergonomic-mesh-office-chair",
    title: "Ergonomic Mesh Office Chair with Lumbar Support",
    brand: "DeskWell",
    categorySlug: "office-productivity",
    shortDescription: "Breathable mesh back, adjustable lumbar support and armrests.",
    longDescription:
      "An ergonomic office chair with breathable mesh backing, adjustable lumbar support, 3D armrests and a tilt-lock mechanism.",
    currency: "USD",
    displayPrice: 189.99,
    originalPrice: null,
    rating: 4.3,
    ratingCount: 1490,
    isFeatured: false,
    isTrending: false,
    marketplaces: ["AMAZON"],
    publishedAt: "2026-06-12",
  },
  {
    slug: "stand-mixer-6qt",
    title: "6-Quart Tilt-Head Stand Mixer",
    brand: "Brewmaster",
    categorySlug: "home-kitchen",
    shortDescription: "10-speed stand mixer with dough hook, whisk and flat beater.",
    longDescription:
      "A 6-quart tilt-head stand mixer with 10 speed settings and a 500W motor, bundled with a dough hook, wire whisk and flat beater.",
    currency: "USD",
    displayPrice: 259.0,
    originalPrice: 329.0,
    rating: 4.8,
    ratingCount: 5230,
    isFeatured: true,
    isTrending: false,
    marketplaces: ["AMAZON", "EBAY"],
    publishedAt: "2026-05-30",
  },
  {
    slug: "smart-home-security-camera",
    title: "1080p Smart Home Security Camera, Indoor/Outdoor",
    brand: "ClearView",
    categorySlug: "electronics",
    shortDescription: "Weatherproof camera with night vision and motion alerts.",
    longDescription:
      "A weatherproof 1080p security camera with color night vision, two-way audio and smart motion alerts sent straight to your phone.",
    currency: "USD",
    displayPrice: 44.99,
    originalPrice: 59.99,
    rating: 4.2,
    ratingCount: 990,
    isFeatured: false,
    isTrending: true,
    marketplaces: ["AMAZON"],
    publishedAt: "2026-08-10",
  },
  {
    slug: "orthopedic-dog-bed-large",
    title: "Orthopedic Memory Foam Dog Bed, Large",
    brand: "CozyPaws",
    categorySlug: "pet-supplies",
    shortDescription: "Supportive memory foam bed with a removable, washable cover.",
    longDescription:
      "A memory-foam dog bed designed for joint support, with a waterproof liner and a removable, machine-washable cover.",
    currency: "USD",
    displayPrice: 54.95,
    originalPrice: null,
    rating: 4.6,
    ratingCount: 4310,
    isFeatured: false,
    isTrending: false,
    marketplaces: ["EBAY"],
    publishedAt: "2026-04-18",
  },
  {
    slug: "mechanical-keyboard-compact",
    title: "75% Compact Mechanical Keyboard, Hot-Swappable",
    brand: "KeyForge",
    categorySlug: "office-productivity",
    shortDescription: "Hot-swappable switches, PBT keycaps and a compact 75% layout.",
    longDescription:
      "A 75% layout mechanical keyboard with hot-swappable switch sockets, double-shot PBT keycaps and per-key RGB lighting.",
    currency: "USD",
    displayPrice: 89.0,
    originalPrice: 109.0,
    rating: 4.5,
    ratingCount: 2670,
    isFeatured: true,
    isTrending: true,
    marketplaces: ["AMAZON", "EBAY"],
    publishedAt: "2026-08-15",
  },
];

async function main() {
  console.log("Seeding database...");

  // --- Admin user -----------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@findit.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await hashPassword(adminPassword);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash, name: "Admin", role: "ADMIN" },
    update: { passwordHash },
  });
  console.log(`Admin user ready: ${adminEmail}`);

  // --- Marketplaces -----------------------------------------------------------
  const marketplaceByCode = new Map<string, string>();
  for (const marketplace of marketplaceSeeds) {
    const record = await prisma.marketplace.upsert({
      where: { code: marketplace.code },
      create: marketplace,
      update: { name: marketplace.name, baseUrl: marketplace.baseUrl },
    });
    marketplaceByCode.set(marketplace.code, record.id);
  }
  console.log(`Marketplaces ready: ${[...marketplaceByCode.keys()].join(", ")}`);

  // --- Categories -------------------------------------------------------------
  const categoryBySlug = new Map<string, string>();
  for (const category of categorySeeds) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
      },
    });
    categoryBySlug.set(category.slug, record.id);
  }
  console.log(`Categories ready: ${categoryBySlug.size}`);

  // --- Products + affiliate links ---------------------------------------------
  const adminUser = await prisma.adminUser.findUnique({ where: { email: adminEmail } });

  for (const seed of productSeeds) {
    const categoryId = categoryBySlug.get(seed.categorySlug);
    if (!categoryId) {
      throw new Error(`Seed data error: unknown category slug "${seed.categorySlug}" for product "${seed.slug}"`);
    }

    const discountPercentage = computeDiscountPercentage(seed.displayPrice, seed.originalPrice);
    const primaryImageUrl = `https://picsum.photos/seed/${seed.slug}/800/800`;

    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        title: seed.title,
        brand: seed.brand,
        categoryId,
        shortDescription: seed.shortDescription,
        longDescription: seed.longDescription,
        status: "PUBLISHED",
        currency: seed.currency,
        displayPrice: seed.displayPrice,
        originalPrice: seed.originalPrice,
        discountPercentage,
        ogImageUrl: primaryImageUrl,
        rating: seed.rating,
        ratingCount: seed.ratingCount,
        isFeatured: seed.isFeatured,
        isTrending: seed.isTrending,
        publishedAt: new Date(seed.publishedAt),
        createdById: adminUser?.id,
      },
      update: {
        title: seed.title,
        brand: seed.brand,
        categoryId,
        shortDescription: seed.shortDescription,
        longDescription: seed.longDescription,
        currency: seed.currency,
        displayPrice: seed.displayPrice,
        originalPrice: seed.originalPrice,
        discountPercentage,
        ogImageUrl: primaryImageUrl,
        rating: seed.rating,
        ratingCount: seed.ratingCount,
        isFeatured: seed.isFeatured,
        isTrending: seed.isTrending,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: [
        {
          productId: product.id,
          url: primaryImageUrl,
          altText: seed.title,
          position: 0,
          isPrimary: true,
        },
        {
          productId: product.id,
          url: `https://picsum.photos/seed/${seed.slug}-alt/800/800`,
          altText: `${seed.title} — alternate view`,
          position: 1,
          isPrimary: false,
        },
      ],
    });

    for (const marketplaceCode of seed.marketplaces) {
      const marketplaceId = marketplaceByCode.get(marketplaceCode);
      if (!marketplaceId) continue;

      await prisma.affiliateLink.upsert({
        where: { productId_marketplaceId: { productId: product.id, marketplaceId } },
        create: {
          productId: product.id,
          marketplaceId,
          externalProductId: seed.slug,
          rawProductUrl: `https://www.${marketplaceCode.toLowerCase()}.com/dp/${seed.slug}`,
          affiliateUrl: `https://www.${marketplaceCode.toLowerCase()}.com/dp/${seed.slug}?tag=findit-20`,
          trackingTag: "findit-20",
          isPrimary: marketplaceCode === seed.marketplaces[0],
        },
        update: {},
      });
    }
  }

  console.log(`Products ready: ${productSeeds.length}`);
  await seedAnalyticsIfEmpty();
  console.log("Seed complete.");
}

async function seedAnalyticsIfEmpty() {
  const existingViews = await prisma.productView.count();
  if (existingViews > 0) {
    console.log("Analytics events already present — skipping event seed.");
    return;
  }

  const products = await prisma.product.findMany({
    include: { affiliateLinks: true },
  });

  if (products.length === 0) return;

  const sources = [
    { source: "google", medium: "organic", campaign: null },
    { source: "google", medium: "cpc", campaign: "spring-picks" },
    { source: "newsletter", medium: "email", campaign: "weekly-digest" },
    { source: "twitter", medium: "social", campaign: "launch" },
    { source: null, medium: null, campaign: null },
  ] as const;

  const now = Date.now();
  const dayMs = 86_400_000;

  for (let index = 0; index < 56; index += 1) {
    const daysAgo = index < 8 ? 0 : (index * 11) % 70;
    const createdAt = new Date(now - daysAgo * dayMs - (index % 10) * 3_600_000);
    const utm = sources[index % sources.length];
    const product = products[index % products.length];

    const session = await prisma.trafficSession.create({
      data: {
        anonymousId: `seed-visitor-${(index % 22) + 1}`,
        landingPath: `/products/${product.slug}`,
        referrer: utm.source ? `https://${utm.source}.com` : null,
        userAgent: "FindItSeed/1.0",
        startedAt: createdAt,
        lastSeenAt: createdAt,
        createdAt,
      },
    });

    if (utm.source) {
      await prisma.uTMEvent.create({
        data: {
          sessionId: session.id,
          source: utm.source,
          medium: utm.medium,
          campaign: utm.campaign,
          landingPath: `/products/${product.slug}`,
          referrer: `https://${utm.source}.com`,
          createdAt,
        },
      });
    }

    const viewCount = 1 + (index % 3);
    for (let viewIndex = 0; viewIndex < viewCount; viewIndex += 1) {
      await prisma.productView.create({
        data: {
          productId: product.id,
          sessionId: session.id,
          path: `/products/${product.slug}`,
          createdAt: new Date(createdAt.getTime() + viewIndex * 45_000),
        },
      });
    }

    const link = product.affiliateLinks[0];
    if (link && index % 3 === 0) {
      await prisma.affiliateClick.create({
        data: {
          productId: product.id,
          affiliateLinkId: link.id,
          marketplaceId: link.marketplaceId,
          sessionId: session.id,
          destinationUrl: link.affiliateUrl,
          createdAt: new Date(createdAt.getTime() + 90_000),
        },
      });
    }
  }

  console.log("Sample analytics events seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
