import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Briefcase,
  Car,
  CookingPot,
  Dumbbell,
  Fish,
  Flower2,
  Gamepad2,
  Headphones,
  HeartPulse,
  Layers,
  Luggage,
  PawPrint,
  Shirt,
  Sparkles,
  Watch,
} from "lucide-react";

const BY_SLUG: Record<string, LucideIcon> = {
  "home-kitchen": CookingPot,
  electronics: Headphones,
  "fitness-outdoors": Dumbbell,
  fishing: Fish,
  "auto-moto": Car,
  "office-productivity": Briefcase,
  "pet-supplies": PawPrint,
  kids: Baby,
  beauty: Sparkles,
  travel: Luggage,
};

const BY_KEYWORD: Array<[RegExp, LucideIcon]> = [
  [/kitchen|cook|home|house|living/, CookingPot],
  [/electron|gadget|audio|tech|phone|comput/, Headphones],
  [/fish|angling|tackle|reel/, Fish],
  [/auto|moto|car|motor|vehicle/, Car],
  [/fitness|sport|outdoor|gym|hike|run/, Dumbbell],
  [/office|desk|productiv|work/, Briefcase],
  [/pet|dog|cat|animal/, PawPrint],
  [/beauty|skin|makeup|groom/, Sparkles],
  [/baby|kid|child|toddler/, Baby],
  [/fashion|cloth|apparel|wear/, Shirt],
  [/garden|plant|yard|lawn/, Flower2],
  [/toy|game|play/, Gamepad2],
  [/health|wellness|care|medical/, HeartPulse],
  [/travel|bag|luggage|carry/, Luggage],
  [/watch|jewel|access/, Watch],
];

/** Distinct Lucide icon for a public category, by slug then name keywords. */
export function categoryIcon(slug: string, name = ""): LucideIcon {
  const fromSlug = BY_SLUG[slug];
  if (fromSlug) return fromSlug;

  const haystack = `${slug} ${name}`.toLowerCase();
  for (const [pattern, icon] of BY_KEYWORD) {
    if (pattern.test(haystack)) return icon;
  }

  return Layers;
}
