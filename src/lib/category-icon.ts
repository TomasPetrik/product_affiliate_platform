import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Briefcase,
  Car,
  CookingPot,
  Dumbbell,
  Flower2,
  Gamepad2,
  Headphones,
  HeartPulse,
  Layers,
  PawPrint,
  Shirt,
  Sparkles,
  Watch,
} from "lucide-react";

const BY_SLUG: Record<string, LucideIcon> = {
  "home-kitchen": CookingPot,
  electronics: Headphones,
  "fitness-outdoors": Dumbbell,
  "office-productivity": Briefcase,
  "pet-supplies": PawPrint,
};

const BY_KEYWORD: Array<[RegExp, LucideIcon]> = [
  [/kitchen|cook|home|house|living/, CookingPot],
  [/electron|gadget|audio|tech|phone|comput/, Headphones],
  [/fitness|sport|outdoor|gym|hike|run/, Dumbbell],
  [/office|desk|productiv|work/, Briefcase],
  [/pet|dog|cat|animal/, PawPrint],
  [/beauty|skin|makeup|groom/, Sparkles],
  [/baby|kid|child|toddler/, Baby],
  [/auto|car|motor|vehicle/, Car],
  [/fashion|cloth|apparel|wear/, Shirt],
  [/garden|plant|yard|lawn/, Flower2],
  [/toy|game|play/, Gamepad2],
  [/health|wellness|care|medical/, HeartPulse],
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
