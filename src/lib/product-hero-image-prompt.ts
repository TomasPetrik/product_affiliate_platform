export interface HeroImagePromptInput {
  title: string;
  brand?: string | null;
  shortDescription?: string | null;
}

/**
 * Builds a ChatGPT / image-model prompt for a clean RadarCut product hero shot.
 */
export function buildProductHeroImagePrompt(input: HeroImagePromptInput): string {
  const title = input.title.trim() || "this product";
  const brand = input.brand?.trim();
  const description = input.shortDescription?.trim();

  const productLine = brand ? `${brand} — ${title}` : title;
  const detailLine = description
    ? `Product context (for accuracy only, do not render as text): ${description}`
    : "Use only what is visible in any images attached to this chat; do not invent features.";

  return `Create a clean ecommerce product hero image for RadarCut based on the product reference photos attached to this chat.

Product: ${productLine}
${detailLine}

Requirements:
- Keep the real product identity accurate (shape, color, branding on the product itself). Do not invent a different product.
- Prefer showing the product itself. If only packaging is visible, use a clean pack shot of that same box — not a lifestyle room photo.
- Remove messy backgrounds (bedspreads, floors, clutter, hands, sellers' rooms).
- Place the product on a seamless soft white / light gray studio background with soft natural shadow.
- Center the product, fill most of the frame, square 1:1 crop suitable for a product card.
- Professional retail catalog look: sharp, even lighting, true colors, no filters.
- No text overlays, badges, watermarks, logos, price tags, or promotional graphics.
- No extra props unless they are part of the product in the source photos.

Output: one high-quality square product photo ready to use as the main image on a product card.`;
}
