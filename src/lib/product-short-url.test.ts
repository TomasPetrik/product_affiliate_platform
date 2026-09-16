import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseProductPublicId, productShortPath } from "@/lib/product-short-url";

describe("productShortPath", () => {
  it("builds /p/{id}", () => {
    assert.equal(productShortPath(42), "/p/42");
  });
});

describe("parseProductPublicId", () => {
  it("accepts positive integers", () => {
    assert.equal(parseProductPublicId("1"), 1);
    assert.equal(parseProductPublicId("42"), 42);
  });

  it("rejects invalid values", () => {
    assert.equal(parseProductPublicId("0"), null);
    assert.equal(parseProductPublicId("-1"), null);
    assert.equal(parseProductPublicId("01"), null);
    assert.equal(parseProductPublicId("abc"), null);
    assert.equal(parseProductPublicId("1.5"), null);
    assert.equal(parseProductPublicId(""), null);
  });
});
