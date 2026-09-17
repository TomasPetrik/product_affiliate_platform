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
  { slug: "home-kitchen", name: "Home & Kitchen", description: "Everyday upgrades for cooking, cleaning and organizing your home.", sortOrder: 0, imageUrl: "/categories/home-kitchen.jpg" },
  { slug: "electronics", name: "Electronics", description: "Gadgets, audio and smart devices worth adding to your cart.", sortOrder: 1, imageUrl: "/categories/electronics.jpg" },
  { slug: "fitness-outdoors", name: "Fitness & Outdoors", description: "Gear for workouts, running and getting outside.", sortOrder: 2, imageUrl: "/categories/fitness-outdoors.jpg" },
  { slug: "fishing", name: "Fishing", description: "Rods, reels, tackle and kit for time on the water.", sortOrder: 3, imageUrl: "/categories/fishing.jpg" },
  { slug: "auto-moto", name: "Auto & Moto", description: "Car and motorcycle gear, detailing and road-trip essentials.", sortOrder: 4, imageUrl: "/categories/auto-moto.jpg" },
  { slug: "pet-supplies", name: "Pet Supplies", description: "Well-reviewed picks for dogs, cats and other companions.", sortOrder: 5, imageUrl: "/categories/pet-supplies.jpg" },
  { slug: "kids", name: "Kids", description: "Toys, gear and everyday essentials for babies and children.", sortOrder: 6, imageUrl: "/categories/kids.jpg" },
  { slug: "beauty", name: "Beauty & Self-care", description: "Skincare, hair tools and quietly excellent self-care picks.", sortOrder: 7, imageUrl: "/categories/beauty.jpg" },
  { slug: "travel", name: "Travel & Everyday Carry", description: "Packing kits, power banks and EDC for getting there.", sortOrder: 8, imageUrl: "/categories/travel.jpg" },
  { slug: "office-productivity", name: "Office & Productivity", description: "Desk setups, organizers and tools for getting things done.", sortOrder: 9, imageUrl: "/categories/office-productivity.jpg" },
];

const marketplaceSeeds = [
  { code: "AMAZON" as const, name: "Amazon", baseUrl: "https://www.amazon.com", isActive: true },
  { code: "EBAY" as const, name: "eBay", baseUrl: "https://www.ebay.com", isActive: true },
  { code: "WALMART" as const, name: "Walmart", baseUrl: "https://www.walmart.com", isActive: false },
  { code: "BEST_BUY" as const, name: "Best Buy", baseUrl: "https://www.bestbuy.com", isActive: false },
  { code: "TARGET" as const, name: "Target", baseUrl: "https://www.target.com", isActive: false },
  { code: "OTHER" as const, name: "Other", baseUrl: "https://example.com", isActive: false },
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
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@radarcut.local";
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
      create: {
        code: marketplace.code,
        name: marketplace.name,
        baseUrl: marketplace.baseUrl,
        isActive: marketplace.isActive,
      },
      update: { name: marketplace.name, baseUrl: marketplace.baseUrl, isActive: marketplace.isActive },
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
        imageUrl: category.imageUrl,
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
        where: {
          marketplaceId_externalProductId: {
            marketplaceId,
            externalProductId: seed.slug,
          },
        },
        create: {
          productId: product.id,
          marketplaceId,
          externalProductId: seed.slug,
          rawProductUrl: `https://www.${marketplaceCode.toLowerCase()}.com/dp/${seed.slug}`,
          affiliateUrl: `https://www.${marketplaceCode.toLowerCase()}.com/dp/${seed.slug}?tag=radarcut-20`,
          trackingTag: "radarcut-20",
          isPrimary: marketplaceCode === seed.marketplaces[0],
          lastKnownPrice: seed.displayPrice,
          lastKnownOriginalPrice: seed.originalPrice,
          lastKnownPriceCurrency: seed.currency,
          lastKnownAvailability: "IN_STOCK",
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
  const [existingViews, existingEvents] = await Promise.all([
    prisma.productView.count(),
    prisma.analyticsEvent.count(),
  ]);

  if (existingEvents > 0) {
    console.log("Analytics events already present — skipping event seed.");
    return;
  }

  if (existingViews > 0) {
    await backfillAnalyticsEventsFromLegacy();
    return;
  }

  const products = await prisma.product.findMany({
    include: { affiliateLinks: true },
  });

  if (products.length === 0) return;

  const sources = [
    { source: "instagram", medium: "social", campaign: "airpods-september" },
    { source: "google", medium: "organic", campaign: null },
    { source: "google", medium: "cpc", campaign: "spring-picks" },
    { source: "facebook", medium: "social", campaign: "headphones-reel-01" },
    { source: "newsletter", medium: "email", campaign: "weekly-digest" },
    { source: null, medium: null, campaign: null },
  ] as const;
  const devices = ["DESKTOP", "MOBILE", "TABLET"] as const;
  const countries = ["US", "GB", "DE", "SK", null] as const;
  const cities = ["New York", "London", "Berlin", "Bratislava", null] as const;
  const queries = ["french press", "headphones", "desk lamp", "yoga mat", "robot lawn mower", "portable ice maker"];

  const now = Date.now();
  const dayMs = 86_400_000;

  for (let index = 0; index < 56; index += 1) {
    const daysAgo = index < 8 ? 0 : (index * 11) % 70;
    const createdAt = new Date(now - daysAgo * dayMs - (index % 10) * 3_600_000);
    const utm = sources[index % sources.length];
    const product = products[index % products.length];
    const deviceType = devices[index % devices.length];
    const country = countries[index % countries.length];
    const city = cities[index % cities.length];

    const session = await prisma.trafficSession.create({
      data: {
        anonymousId: `seed-visitor-${(index % 22) + 1}`,
        landingPath: `/products/${product.slug}`,
        referrer: utm.source ? `https://${utm.source}.com` : null,
        userAgent: "RadarCutSeed/1.0",
        deviceType,
        country,
        city,
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

    await seedSessionEvents({
      sessionId: session.id,
      visitorId: session.anonymousId,
      product,
      link: link && index % 3 === 0 ? link : null,
      utm,
      deviceType,
      country,
      city,
      createdAt,
      searchQuery: index % 4 === 0 ? queries[index % queries.length] : null,
      includeCategory: index % 2 === 0,
      includeOutbound: index % 7 === 0,
    });
  }

  console.log("Sample analytics events seeded.");
}

async function backfillAnalyticsEventsFromLegacy() {
  const sessions = await prisma.trafficSession.findMany({
    include: {
      productViews: { include: { product: { select: { categoryId: true, slug: true } } } },
      affiliateClicks: true,
      utmEvents: { orderBy: { createdAt: "asc" }, take: 1 },
    },
    take: 200,
  });

  for (const session of sessions) {
    const utm = session.utmEvents[0];
    const firstView = session.productViews[0];

    await prisma.analyticsEvent.create({
      data: {
        type: "PAGE_VIEW",
        visitorId: session.anonymousId,
        sessionId: session.id,
        productId: firstView?.productId,
        categoryId: firstView?.product.categoryId,
        path: session.landingPath,
        landingPath: session.landingPath,
        referrer: session.referrer,
        utmSource: utm?.source,
        utmMedium: utm?.medium,
        utmCampaign: utm?.campaign,
        utmContent: utm?.content,
        utmTerm: utm?.term,
        deviceType: session.deviceType,
        country: session.country,
        city: session.city,
        dedupeKey: `backfill:page_view:${session.id}`,
        createdAt: session.startedAt,
      },
    });

    for (const view of session.productViews) {
      await prisma.analyticsEvent.create({
        data: {
          type: "PRODUCT_VIEW",
          visitorId: session.anonymousId,
          sessionId: session.id,
          productId: view.productId,
          categoryId: view.product.categoryId,
          path: view.path,
          landingPath: session.landingPath,
          referrer: session.referrer,
          utmSource: utm?.source,
          utmMedium: utm?.medium,
          utmCampaign: utm?.campaign,
          deviceType: session.deviceType,
          country: session.country,
          city: session.city,
          dedupeKey: `backfill:product_view:${view.id}`,
          createdAt: view.createdAt,
        },
      });
    }

    for (const click of session.affiliateClicks) {
      await prisma.analyticsEvent.create({
        data: {
          type: "AFFILIATE_CLICK",
          visitorId: session.anonymousId,
          sessionId: session.id,
          productId: click.productId,
          affiliateLinkId: click.affiliateLinkId,
          destinationUrl: click.destinationUrl,
          path: session.landingPath,
          landingPath: session.landingPath,
          referrer: session.referrer,
          utmSource: utm?.source,
          utmMedium: utm?.medium,
          utmCampaign: utm?.campaign,
          deviceType: session.deviceType,
          country: session.country,
          city: session.city,
          dedupeKey: `backfill:affiliate_click:${click.id}`,
          createdAt: click.createdAt,
        },
      });
    }
  }

  console.log("Analytics events backfilled from existing views and clicks.");
}

async function seedSessionEvents({
  sessionId,
  visitorId,
  product,
  link,
  utm,
  deviceType,
  country,
  city,
  createdAt,
  searchQuery,
  includeCategory,
  includeOutbound,
}: {
  sessionId: string;
  visitorId: string;
  product: { id: string; slug: string; categoryId: string };
  link: { id: string; affiliateUrl: string } | null;
  utm: { source: string | null; medium: string | null; campaign: string | null };
  deviceType: "DESKTOP" | "MOBILE" | "TABLET";
  country: string | null;
  city: string | null;
  createdAt: Date;
  searchQuery: string | null;
  includeCategory: boolean;
  includeOutbound: boolean;
}) {
  const path = `/products/${product.slug}`;
  const attribution = {
    visitorId,
    sessionId,
    productId: product.id,
    categoryId: product.categoryId,
    path,
    landingPath: path,
    referrer: utm.source ? `https://${utm.source}.com` : null,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    deviceType,
    country,
    city,
  };

  await prisma.analyticsEvent.create({
    data: {
      type: "PAGE_VIEW",
      ...attribution,
      dedupeKey: `seed:page_view:${sessionId}`,
      createdAt,
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      type: "PRODUCT_VIEW",
      ...attribution,
      dedupeKey: `seed:product_view:${sessionId}:${product.id}`,
      createdAt: new Date(createdAt.getTime() + 5_000),
    },
  });

  if (includeCategory) {
    await prisma.analyticsEvent.create({
      data: {
        type: "CATEGORY_VIEW",
        ...attribution,
        path: `/categories`,
        dedupeKey: `seed:category_view:${sessionId}:${product.categoryId}`,
        createdAt: new Date(createdAt.getTime() + 8_000),
      },
    });
  }

  if (searchQuery) {
    const zero = searchQuery === "robot lawn mower" || searchQuery === "portable ice maker";
    await prisma.analyticsEvent.create({
      data: {
        type: "SEARCH",
        ...attribution,
        path: "/products",
        searchQuery,
        resultCount: zero ? 0 : 3,
        sourceNormalized: utm.source === "instagram" ? "Instagram" : utm.source === "google" ? "Google" : utm.source === "facebook" ? "Facebook" : utm.source ? "Other" : "Direct",
        firstUtmSource: utm.source,
        firstUtmCampaign: utm.campaign,
        dedupeKey: `seed:search:${sessionId}:${searchQuery}`,
        createdAt: new Date(createdAt.getTime() + 12_000),
      },
    });

    if (zero) {
      await prisma.analyticsEvent.create({
        data: {
          type: "NO_SEARCH_RESULTS",
          ...attribution,
          path: "/products",
          searchQuery,
          resultCount: 0,
          sourceNormalized: utm.source === "instagram" ? "Instagram" : "Direct",
          dedupeKey: `seed:no_search:${sessionId}:${searchQuery}`,
          createdAt: new Date(createdAt.getTime() + 12_500),
        },
      });
    } else {
      await prisma.analyticsEvent.create({
        data: {
          type: "SEARCH_RESULT_CLICK",
          ...attribution,
          path: `/products/${product.slug}`,
          searchQuery,
          sourceNormalized: utm.source === "instagram" ? "Instagram" : "Direct",
          dedupeKey: `seed:search_click:${sessionId}:${searchQuery}`,
          createdAt: new Date(createdAt.getTime() + 13_000),
        },
      });
    }
  }

  if (link) {
    await prisma.analyticsEvent.create({
      data: {
        type: "RETAILER_OFFER_VIEW",
        ...attribution,
        affiliateLinkId: link.id,
        sourceNormalized: utm.source === "instagram" ? "Instagram" : "Direct",
        dedupeKey: `seed:offer_view:${sessionId}:${link.id}`,
        createdAt: new Date(createdAt.getTime() + 20_000),
      },
    });

    await prisma.analyticsEvent.create({
      data: {
        type: "AFFILIATE_CLICK",
        ...attribution,
        affiliateLinkId: link.id,
        destinationUrl: link.affiliateUrl,
        sourceNormalized: utm.source === "instagram" ? "Instagram" : utm.source === "google" ? "Google" : utm.source === "facebook" ? "Facebook" : utm.source ? "Other" : "Direct",
        firstUtmSource: utm.source,
        firstUtmCampaign: utm.campaign,
        dedupeKey: `seed:affiliate_click:${sessionId}:${link.id}`,
        createdAt: new Date(createdAt.getTime() + 90_000),
      },
    });
  }

  if (includeOutbound) {
    await prisma.analyticsEvent.create({
      data: {
        type: "OUTBOUND_CLICK",
        ...attribution,
        destinationUrl: "https://www.amazon.com",
        dedupeKey: `seed:outbound_click:${sessionId}`,
        createdAt: new Date(createdAt.getTime() + 100_000),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
