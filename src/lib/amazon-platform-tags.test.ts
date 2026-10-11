import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  missingAmazonAssociatesPlatformTags,
  parseSocialPlatformParam,
  resolveAmazonAssociatesTagForPlatform,
} from "./amazon-platform-tags";

describe("parseSocialPlatformParam", () => {
  it("accepts common casing", () => {
    assert.equal(parseSocialPlatformParam("instagram"), "INSTAGRAM");
    assert.equal(parseSocialPlatformParam("TIKTOK"), "TIKTOK");
    assert.equal(parseSocialPlatformParam("nope"), null);
  });
});

describe("resolveAmazonAssociatesTagForPlatform", () => {
  it("prefers platform tag over fallback", () => {
    assert.equal(
      resolveAmazonAssociatesTagForPlatform(
        "INSTAGRAM",
        {
          INSTAGRAM: "radarcut-ig-20",
          FACEBOOK: null,
          YOUTUBE: null,
          TIKTOK: null,
        },
        "radarcut-20",
      ),
      "radarcut-ig-20",
    );
  });

  it("falls back to legacy tag", () => {
    assert.equal(
      resolveAmazonAssociatesTagForPlatform(
        "FACEBOOK",
        {
          INSTAGRAM: null,
          FACEBOOK: null,
          YOUTUBE: null,
          TIKTOK: null,
        },
        "radarcut-20",
      ),
      "radarcut-20",
    );
  });
});

describe("missingAmazonAssociatesPlatformTags", () => {
  it("lists platforms without a resolvable tag", () => {
    assert.deepEqual(
      missingAmazonAssociatesPlatformTags({
        INSTAGRAM: "radarcut-ig-20",
        FACEBOOK: "",
        YOUTUBE: "radarcut-yt-20",
        TIKTOK: null,
      }),
      ["FACEBOOK", "TIKTOK"],
    );
  });
});
