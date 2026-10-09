import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

describe("getTikTokAdsRedirectUri", () => {
  before(() => {
    process.env.DATABASE_URL ??= "postgresql://localhost:5432/radarcut_test";
    process.env.AUTH_SECRET ??= "test-auth-secret-at-least-32-chars-long!!";
    process.env.NEXT_PUBLIC_SITE_URL ??= "https://radarcut.com";
  });

  it("includes the trailing slash required by the Marketing API app registration", async () => {
    const { getTikTokAdsRedirectUri } = await import("./tiktok-ads");
    const uri = getTikTokAdsRedirectUri();
    assert.equal(uri, "https://radarcut.com/api/tiktok/oauth/callback/");
  });
});
