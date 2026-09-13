import type { CategorySummary, ProductDetail, ProductSummary } from "@/types/catalog";

/**
 * Placeholder catalog data for Phase 1.
 *
 * The public site and admin dashboard render from this in-memory data set
 * so the UI can be built, reviewed and verified (typecheck/lint/build)
 * without requiring a live PostgreSQL database or seeded data.
 *
 * TODO(next phase): replace these lookups with real queries through
 * `src/lib/prisma.ts` / `src/server/services/*` once the database is
 * provisioned and migrated, and remove this module.
 */

const categoryDefs = [
  { slug: "home-kitchen", name: "Home & Kitchen", description: "Everyday upgrades for cooking, cleaning and organizing your home." },
  { slug: "electronics", name: "Electronics", description: "Gadgets, audio and smart devices worth adding to your cart." },
  { slug: "fitness-outdoors", name: "Fitness & Outdoors", description: "Gear for workouts, running and getting outside." },
  { slug: "office-productivity", name: "Office & Productivity", description: "Desk setups, organizers and tools for getting things done." },
  { slug: "pet-supplies", name: "Pet Supplies", description: "Well-reviewed picks for dogs, cats and other companions." },
] as const;

const productSeed: Array<{
  slug: string;
  title: string;
  brand: string;
  categorySlug: (typeof categoryDefs)[number]["slug"];
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
}> = [
  {
    slug: "stainless-steel-french-press",
    title: "Stainless Steel French Press, 34oz",
    brand: "Brewmaster",
    categorySlug: "home-kitchen",
    shortDescription: "Double-wall insulated French press that keeps coffee hot for hours.",
    longDescription:
      "A durable, double-wall insulated stainless steel French press built for daily use. Keeps coffee hot for longer than glass alternatives, includes a fine-mesh filter to reduce sediment, and is easy to disassemble for cleaning. A frequently recommended upgrade pick for anyone moving on from a basic drip machine.",
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
      "Compact true-wireless earbuds with active noise cancellation, transparency mode, and a 30-hour combined battery life with the charging case. IPX5 water resistance makes them workout-friendly. A consistently well-reviewed mid-range pick for commuters and travelers.",
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
      "A quick-select adjustable dumbbell pair that replaces a full rack of fixed weights, ranging from 5 to 52.5 lbs per hand. Popular for home gyms with limited space. Dial mechanism allows changing weight in seconds between sets.",
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
      "An ergonomic office chair with breathable mesh backing, adjustable lumbar support, 3D armrests and a tilt-lock mechanism. A commonly recommended budget alternative to premium ergonomic chairs for home offices.",
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
      "A 6-quart tilt-head stand mixer with 10 speed settings and a 500W motor, bundled with a dough hook, wire whisk and flat beater. A long-time favorite for home bakers who need consistent results for bread, cookies and cake batter.",
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
      "A weatherproof 1080p security camera with color night vision, two-way audio and smart motion alerts sent straight to your phone. Works indoors or outdoors and supports local or cloud storage depending on plan.",
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
      "A memory-foam dog bed designed for joint support, with a waterproof liner and a removable, machine-washable cover. A popular pick for older dogs or larger breeds that need extra support.",
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
      "A 75% layout mechanical keyboard with hot-swappable switch sockets, double-shot PBT keycaps and per-key RGB lighting. A frequently recommended entry point into the mechanical keyboard hobby.",
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

function toCategorySummary(slug: (typeof categoryDefs)[number]["slug"]): CategorySummary {
  const def = categoryDefs.find((category) => category.slug === slug);

  if (!def) {
    throw new Error(`Unknown category slug in placeholder data: ${slug}`);
  }

  const productCount = productSeed.filter((product) => product.categorySlug === slug).length;

  return {
    id: def.slug,
    slug: def.slug,
    name: def.name,
    description: def.description,
    productCount,
  };
}

const marketplaceLabels: Record<"AMAZON" | "EBAY", string> = {
  AMAZON: "Amazon",
  EBAY: "eBay",
};

// Placeholder outbound destinations. Real per-product affiliate URLs (with
// tracking tags) are wired up during the marketplace integration phase.
const marketplacePlaceholderHref: Record<"AMAZON" | "EBAY", string> = {
  AMAZON: "https://www.amazon.com/",
  EBAY: "https://www.ebay.com/",
};

function toProductDetail(seed: (typeof productSeed)[number]): ProductDetail {
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    brand: seed.brand,
    category: toCategorySummary(seed.categorySlug),
    status: "PUBLISHED",
    shortDescription: seed.shortDescription,
    longDescription: seed.longDescription,
    currency: seed.currency,
    displayPrice: seed.displayPrice,
    originalPrice: seed.originalPrice,
    rating: seed.rating,
    ratingCount: seed.ratingCount,
    isFeatured: seed.isFeatured,
    isTrending: seed.isTrending,
    marketplaces: seed.marketplaces.map((code) => ({
      marketplace: code,
      label: marketplaceLabels[code],
      href: marketplacePlaceholderHref[code],
    })),
    publishedAt: seed.publishedAt,
  };
}

const products: ProductDetail[] = productSeed.map(toProductDetail);

export function getAllCategories(): CategorySummary[] {
  return categoryDefs.map((category) => toCategorySummary(category.slug));
}

export function getCategoryBySlug(slug: string): CategorySummary | undefined {
  return getAllCategories().find((category) => category.slug === slug);
}

export function getAllProducts(): ProductSummary[] {
  return products;
}

export function getProductBySlug(slug: string): ProductDetail | undefined {
  return products.find((product) => product.slug === slug);
}

export function getFeaturedProducts(limit = 4): ProductSummary[] {
  return products.filter((product) => product.isFeatured).slice(0, limit);
}

export function getTrendingProducts(limit = 4): ProductSummary[] {
  return products.filter((product) => product.isTrending).slice(0, limit);
}

export function getProductsByCategorySlug(slug: string): ProductSummary[] {
  return products.filter((product) => product.category.slug === slug);
}

export function searchProducts(query: string): ProductSummary[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return products;
  }

  return products.filter((product) =>
    [product.title, product.brand, product.shortDescription, product.category.name]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function getRelatedProducts(product: ProductSummary, limit = 4): ProductSummary[] {
  return products
    .filter((candidate) => candidate.slug !== product.slug && candidate.category.slug === product.category.slug)
    .slice(0, limit);
}
