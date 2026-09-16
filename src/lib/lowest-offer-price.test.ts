import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickLowestPricedOffer } from "@/lib/lowest-offer-price";

describe("pickLowestPricedOffer", () => {
  it("returns null when no offers have a price", () => {
    assert.equal(pickLowestPricedOffer([{ lastKnownPrice: null }, { lastKnownPrice: undefined }]), null);
    assert.equal(pickLowestPricedOffer([]), null);
  });

  it("picks the lowest priced offer regardless of primary flag", () => {
    const amazon = { id: "amazon", isPrimary: true, lastKnownPrice: 26.38 };
    const ebay = { id: "ebay", isPrimary: false, lastKnownPrice: 18.99 };
    assert.deepEqual(pickLowestPricedOffer([amazon, ebay]), ebay);
  });

  it("ignores non-finite prices", () => {
    const valid = { id: "valid", lastKnownPrice: 12 };
    assert.deepEqual(
      pickLowestPricedOffer([{ lastKnownPrice: Number.NaN }, valid, { lastKnownPrice: -1 }]),
      valid,
    );
  });
});
