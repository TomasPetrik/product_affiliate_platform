import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeTrafficSource } from "./analytics-source";

describe("normalizeTrafficSource", () => {
  it("prefers utm_source over the referrer", () => {
    assert.equal(normalizeTrafficSource("instagram", "https://www.google.com/"), "Instagram");
  });

  it("maps Instagram, Google, Facebook, YouTube, and TikTok referrers", () => {
    assert.equal(normalizeTrafficSource(null, "https://l.instagram.com/"), "Instagram");
    assert.equal(normalizeTrafficSource(null, "https://www.google.com/search?q=x"), "Google");
    assert.equal(normalizeTrafficSource(null, "https://m.facebook.com/"), "Facebook");
    assert.equal(normalizeTrafficSource(null, "https://www.youtube.com/watch?v=abc"), "YouTube");
    assert.equal(normalizeTrafficSource(null, "https://www.tiktok.com/@x/video/1"), "TikTok");
  });

  it("maps YouTube and TikTok utm_source aliases", () => {
    assert.equal(normalizeTrafficSource("youtube", null), "YouTube");
    assert.equal(normalizeTrafficSource("yt", null), "YouTube");
    assert.equal(normalizeTrafficSource("tiktok", null), "TikTok");
    assert.equal(normalizeTrafficSource("tt", null), "TikTok");
  });

  it("returns Direct when there is no UTM and no referrer", () => {
    assert.equal(normalizeTrafficSource(null, null), "Direct");
  });

  it("returns Other for unrecognized hosts", () => {
    assert.equal(normalizeTrafficSource(null, "https://example.net/blog"), "Other");
  });
});
