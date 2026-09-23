import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

describe("token-crypto", () => {
  before(() => {
    process.env.DATABASE_URL ??= "postgresql://localhost:5432/radarcut_test";
    process.env.AUTH_SECRET ??= "test-auth-secret-at-least-32-chars-long!!";
    process.env.NEXT_PUBLIC_SITE_URL ??= "https://radarcut.com";
  });

  it("round-trips secrets", async () => {
    const { decryptSecret, encryptSecret } = await import("./token-crypto");
    const plaintext = "act.example-token-value";
    const encrypted = encryptSecret(plaintext);
    assert.match(encrypted, /^v1:/);
    assert.notEqual(encrypted, plaintext);
    assert.equal(decryptSecret(encrypted), plaintext);
  });

  it("compares strings in constant time", async () => {
    const { safeEqualString } = await import("./token-crypto");
    assert.equal(safeEqualString("abc", "abc"), true);
    assert.equal(safeEqualString("abc", "abd"), false);
    assert.equal(safeEqualString("abc", "ab"), false);
  });
});
