import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEbayListingInput } from "./ebay-url";

describe("parseEbayListingInput", () => {
  it("accepts a raw legacy item id", () => {
    assert.equal(parseEbayListingInput("123456789").legacyItemId, "123456789");
  });

  it("extracts the id from a sandbox listing URL", () => {
    assert.equal(
      parseEbayListingInput("https://sandbox.ebay.com/itm/110043753715").legacyItemId,
      "110043753715",
    );
  });

  it("extracts the id from a standard itm URL", () => {
    assert.equal(
      parseEbayListingInput("https://www.ebay.com/itm/123456789").legacyItemId,
      "123456789",
    );
  });

  it("extracts the id from a slug + id URL", () => {
    assert.equal(
      parseEbayListingInput("https://www.ebay.com/itm/sony-wh-1000xm5/257234567890?hash=item").legacyItemId,
      "257234567890",
    );
  });

  it("extracts a REST v1 item id's legacy portion", () => {
    assert.equal(parseEbayListingInput("v1|123456789|0").legacyItemId, "123456789");
  });

  it("rejects a non-eBay URL", () => {
    assert.throws(() => parseEbayListingInput("https://www.amazon.com/dp/B000"), /Only eBay/);
  });

  it("rejects an eBay URL without an item id", () => {
    assert.throws(() => parseEbayListingInput("https://www.ebay.com/sch/i.html?_nkw=headphones"), /Could not find/);
  });
});
