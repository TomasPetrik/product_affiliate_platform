import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { autoLabelFromPlatforms, parseSocialExternalId } from "./social-external-id";

describe("parseSocialExternalId", () => {
  it("parses YouTube IDs and URLs", () => {
    assert.deepEqual(parseSocialExternalId("YOUTUBE", "dQw4w9WgXcQ"), {
      ok: true,
      externalId: "dQw4w9WgXcQ",
    });
    assert.deepEqual(
      parseSocialExternalId("YOUTUBE", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      { ok: true, externalId: "dQw4w9WgXcQ" },
    );
    assert.deepEqual(parseSocialExternalId("YOUTUBE", "https://youtu.be/dQw4w9WgXcQ"), {
      ok: true,
      externalId: "dQw4w9WgXcQ",
    });
    assert.deepEqual(
      parseSocialExternalId("YOUTUBE", "https://www.youtube.com/shorts/dQw4w9WgXcQ"),
      { ok: true, externalId: "dQw4w9WgXcQ" },
    );
  });

  it("parses TikTok numeric IDs and video URLs", () => {
    assert.deepEqual(parseSocialExternalId("TIKTOK", "7123456789012345678"), {
      ok: true,
      externalId: "7123456789012345678",
    });
    assert.deepEqual(
      parseSocialExternalId("TIKTOK", "https://www.tiktok.com/@user/video/7123456789012345678"),
      { ok: true, externalId: "7123456789012345678" },
    );
  });

  it("accepts Graph media IDs for Instagram and Facebook", () => {
    assert.deepEqual(parseSocialExternalId("INSTAGRAM", "17841400000000000"), {
      ok: true,
      externalId: "17841400000000000",
    });
    const igUrl = parseSocialExternalId("INSTAGRAM", "https://www.instagram.com/reel/AbC_12-3/");
    assert.equal(igUrl.ok, false);
    if (!igUrl.ok) {
      assert.equal(igUrl.error, "INSTAGRAM_URL_NEEDS_RESOLVE");
    }
    assert.equal(parseSocialExternalId("FACEBOOK", "not-an-id").ok, false);
  });
});

describe("extractInstagramShortcode", () => {
  it("extracts reel and post shortcodes", async () => {
    const { extractInstagramShortcode } = await import("./social-external-id");
    assert.equal(
      extractInstagramShortcode("https://www.instagram.com/reel/AbC_12-3/"),
      "AbC_12-3",
    );
    assert.equal(extractInstagramShortcode("https://www.instagram.com/p/XYZ789/"), "XYZ789");
  });
});

describe("autoLabelFromPlatforms", () => {
  it("uses a single platform name", () => {
    assert.equal(autoLabelFromPlatforms(["YOUTUBE"]), "YouTube");
    assert.equal(autoLabelFromPlatforms(["INSTAGRAM"]), "Instagram");
  });

  it("joins multiple platforms in stable order", () => {
    assert.equal(autoLabelFromPlatforms(["YOUTUBE", "INSTAGRAM"]), "Instagram · YouTube");
    assert.equal(
      autoLabelFromPlatforms(["TIKTOK", "FACEBOOK", "YOUTUBE"]),
      "Facebook · YouTube · TikTok",
    );
  });
});
