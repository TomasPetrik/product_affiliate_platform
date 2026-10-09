import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  affiliateGoHref,
  pickAffiliateHopMarketplaceCode,
} from "./affiliate-go";

describe("pickAffiliateHopMarketplaceCode", () => {
  it("prefers the active primary marketplace", () => {
    assert.equal(
      pickAffiliateHopMarketplaceCode([
        { marketplace: "EBAY", isPrimary: false, isActive: true, affiliateUrl: "https://ebay.example/1" },
        { marketplace: "AMAZON", isPrimary: true, isActive: true, affiliateUrl: "https://amazon.example/1" },
      ]),
      "AMAZON",
    );
  });

  it("skips inactive or empty primary and uses the first usable link", () => {
    assert.equal(
      pickAffiliateHopMarketplaceCode([
        { marketplace: "EBAY", isPrimary: true, isActive: false, affiliateUrl: "https://ebay.example/1" },
        { marketplace: "AMAZON", isPrimary: false, isActive: true, affiliateUrl: "https://amazon.example/1" },
      ]),
      "AMAZON",
    );
    assert.equal(
      pickAffiliateHopMarketplaceCode([
        { marketplace: "EBAY", isPrimary: true, isActive: true, affiliateUrl: "" },
        { marketplace: "AMAZON", isPrimary: false, isActive: true, affiliateUrl: "https://amazon.example/1" },
      ]),
      "AMAZON",
    );
  });

  it("respects forceAmazonOnly so hop URLs never point at filtered retailers", () => {
    assert.equal(
      pickAffiliateHopMarketplaceCode(
        [
          { marketplace: "EBAY", isPrimary: true, isActive: true, affiliateUrl: "https://ebay.example/1", price: 10 },
          { marketplace: "AMAZON", isPrimary: false, isActive: true, affiliateUrl: "https://amazon.example/1", price: 20 },
        ],
        { forceAmazonOnly: true, preferAmazonWhenCheapest: false },
      ),
      "AMAZON",
    );
  });
});

describe("affiliateGoHref", () => {
  it("lowercases marketplace query params", () => {
    assert.equal(
      affiliateGoHref("steam-cleaner-10-in-1-detachable-handheld-steam-mop-for-multi-surface", "AMAZON"),
      "/go/steam-cleaner-10-in-1-detachable-handheld-steam-mop-for-multi-surface?m=amazon",
    );
  });
});
