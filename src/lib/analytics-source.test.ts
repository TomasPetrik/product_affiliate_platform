import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeTrafficSource } from "./analytics-source";

describe("normalizeTrafficSource", () => {
  it("prefers utm_source over the referrer", () => {
    assert.equal(normalizeTrafficSource("instagram", "https://www.google.com/"), "Instagram");
  });

  it("maps Instagram, Google, and Facebook referrers", () => {
    assert.equal(normalizeTrafficSource(null, "https://l.instagram.com/"), "Instagram");
    assert.equal(normalizeTrafficSource(null, "https://www.google.com/search?q=x"), "Google");
    assert.equal(normalizeTrafficSource(null, "https://m.facebook.com/"), "Facebook");
  });

  it("returns Direct when there is no UTM and no referrer", () => {
    assert.equal(normalizeTrafficSource(null, null), "Direct");
  });

  it("returns Other for unrecognized hosts", () => {
    assert.equal(normalizeTrafficSource(null, "https://example.net/blog"), "Other");
  });
});
