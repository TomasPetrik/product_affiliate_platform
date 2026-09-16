const BY_SLUG: Record<string, string> = {
  "home-kitchen": "/categories/home-kitchen.jpg",
  electronics: "/categories/electronics.jpg",
  "fitness-outdoors": "/categories/fitness-outdoors.jpg",
  fishing: "/categories/fishing.jpg",
  "auto-moto": "/categories/auto-moto.jpg",
  "pet-supplies": "/categories/pet-supplies.jpg",
  beauty: "/categories/beauty.jpg",
  travel: "/categories/travel.jpg",
  "office-productivity": "/categories/office-productivity.jpg",
};

/**
 * Cover art for public category cards. Prefers a stored URL, then a
 * bundled image for the known aisles so cards never inherit a random
 * product photo.
 */
export function categoryCoverImage(slug: string, storedUrl?: string | null): string | null {
  if (storedUrl) return storedUrl;
  return BY_SLUG[slug] ?? null;
}
