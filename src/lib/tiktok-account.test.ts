import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

describe("getTikTokAccountRedirectUri", () => {
  before(() => {
    process.env.DATABASE_URL ??= "postgresql://localhost:5432/radarcut_test";
    process.env.AUTH_SECRET ??= "test-auth-secret-at-least-32-chars-long!!";
    process.env.NEXT_PUBLIC_SITE_URL ??= "https://radarcut.com";
  });

  it("matches the TikTok account holder redirect URL (trailing slash)", async () => {
    const { getTikTokAccountRedirectUri } = await import("./tiktok-account");
    assert.equal(getTikTokAccountRedirectUri(), "https://radarcut.com/api/tiktok/account/callback/");
  });
});
