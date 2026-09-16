const TAGLINES: Record<string, string> = {
  "home-kitchen": "Everyday upgrades worth living with.",
  electronics: "Gadgets worth knowing about.",
  "fitness-outdoors": "Gear that actually gets used.",
  fishing: "Kit that earns its place on the boat.",
  "auto-moto": "Road-ready picks that hold up.",
  "office-productivity": "Tools for getting things done.",
  "pet-supplies": "Picks your pets will thank you for.",
  kids: "Gear and toys worth growing into.",
  beauty: "Quietly excellent self-care.",
  travel: "Better kit for getting there.",
  "style-accessories": "Pieces with staying power.",
};

const BY_KEYWORD: Array<[RegExp, string]> = [
  [/kitchen|cook|home|house|living/, "Everyday upgrades worth living with."],
  [/electron|gadget|audio|tech|phone|comput/, "Gadgets worth knowing about."],
  [/fish|angling|tackle|reel/, "Kit that earns its place on the boat."],
  [/auto|moto|car|motor|vehicle/, "Road-ready picks that hold up."],
  [/fitness|sport|outdoor|gym|hike|run/, "Gear that actually gets used."],
  [/office|desk|productiv|work/, "Tools for getting things done."],
  [/pet|dog|cat|animal/, "Picks your pets will thank you for."],
  [/kid|child|baby|toddler|toy/, "Gear and toys worth growing into."],
  [/beauty|skin|makeup|groom/, "Quietly excellent self-care."],
  [/fashion|cloth|apparel|wear|style|access/, "Pieces with staying power."],
  [/travel|bag|luggage|carry/, "Better kit for getting there."],
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
