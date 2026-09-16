import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Upsert public category taxonomy only (no demo products/admin).
 * Safe for production after deploy when seed.ts would be too heavy.
 *
 * Usage: npx tsx scripts/sync-categories.ts
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

async function main() {
  for (const category of categorySeeds) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        imageUrl: category.imageUrl,
      },
    });
  }
  console.log(`Synced ${categorySeeds.length} categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
