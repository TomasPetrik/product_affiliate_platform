const TAGLINES: Record<string, string> = {
  "home-kitchen": "Everyday upgrades worth living with.",
  electronics: "Gadgets worth knowing about.",
  "fitness-outdoors": "Gear that actually gets used.",
  "office-productivity": "Tools for getting things done.",
  "pet-supplies": "Picks your pets will thank you for.",
  "style-accessories": "Pieces with staying power.",
  travel: "Better kit for getting there.",
  beauty: "Quietly excellent self-care.",
};

const BY_KEYWORD: Array<[RegExp, string]> = [
  [/kitchen|cook|home|house|living/, "Everyday upgrades worth living with."],
  [/electron|gadget|audio|tech|phone|comput/, "Gadgets worth knowing about."],
  [/fitness|sport|outdoor|gym|hike|run/, "Gear that actually gets used."],
  [/office|desk|productiv|work/, "Tools for getting things done."],
  [/pet|dog|cat|animal/, "Picks your pets will thank you for."],
  [/beauty|skin|makeup|groom/, "Quietly excellent self-care."],
  [/fashion|cloth|apparel|wear|style|access/, "Pieces with staying power."],
  [/travel|bag|luggage/, "Better kit for getting there."],
];

/** Short editorial line for category cards. Falls back to the stored description. */
export function categoryTagline(slug: string, name = "", fallback = "Worth exploring."): string {
  const fromSlug = TAGLINES[slug];
  if (fromSlug) return fromSlug;

  const haystack = `${slug} ${name}`.toLowerCase();
  for (const [pattern, line] of BY_KEYWORD) {
    if (pattern.test(haystack)) return line;
  }

  const firstSentence = fallback.split(".")[0]?.trim();
  return firstSentence ? `${firstSentence}.` : "Worth exploring.";
}
