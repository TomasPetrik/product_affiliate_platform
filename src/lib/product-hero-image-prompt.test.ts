import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProductHeroImagePrompt } from "./product-hero-image-prompt";

describe("buildProductHeroImagePrompt", () => {
  it("includes product identity and studio requirements", () => {
    const prompt = buildProductHeroImagePrompt({
      title: "Intelligent Window Cleaning Robot",
      brand: "CLEVIO",
      shortDescription: "Automatic window cleaner with one-direction spraying.",
    });

    assert.match(prompt, /CLEVIO — Intelligent Window Cleaning Robot/);
    assert.match(prompt, /Automatic window cleaner with one-direction spraying/);
    assert.match(prompt, /seamless soft white/);
    assert.match(prompt, /square 1:1/);
    assert.match(prompt, /No text overlays/);
    assert.doesNotMatch(prompt, /Reference product photos/);
  });

  it("falls back when description is missing", () => {
    const prompt = buildProductHeroImagePrompt({
      title: "Window Robot",
      brand: "CLEVIO",
    });

    assert.match(prompt, /CLEVIO — Window Robot/);
    assert.match(prompt, /images attached to this chat/);
    assert.doesNotMatch(prompt, /Reference product photos/);
  });
});
