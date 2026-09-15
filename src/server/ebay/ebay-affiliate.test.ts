import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEbayPartnerNetworkUrl,
  ebayAffiliateReferenceId,
  resolveEbayAffiliateUrl,
} from "./ebay-affiliate";

describe("ebayAffiliateReferenceId", () => {
  it("uses the RadarCut product id when known", () => {
    assert.equal(ebayAffiliateReferenceId({ productId: "clxyz123", itemId: "111" }), "radarcut-product-clxyz123");
  });

  it("falls back to the eBay item id", () => {
    assert.equal(ebayAffiliateReferenceId({ itemId: "123456789" }), "radarcut-ebay-123456789");
  });
});

describe("resolveEbayAffiliateUrl", () => {
  const productUrl = "https://www.ebay.com/itm/123456789";

  it("prefers the Browse API affiliate URL", () => {
    const affiliate = "https://www.ebay.com/itm/123456789?campid=123&customid=radarcut-ebay-123456789";
    assert.equal(
      resolveEbayAffiliateUrl({
        itemAffiliateWebUrl: affiliate,
        productUrl,
        campaignId: "999",
        customId: "radarcut-ebay-123456789",
      }),
      affiliate,
    );
  });

  it("does not store the untracked product URL as the affiliate URL", () => {
    const result = resolveEbayAffiliateUrl({
      itemAffiliateWebUrl: productUrl,
      productUrl,
      campaignId: "5338123456",
      customId: "radarcut-ebay-123456789",
    });
    assert.notEqual(result, productUrl);
    assert.match(result, /campid=5338123456/);
    assert.match(result, /customid=radarcut-ebay-123456789/);
  });

  it("fails when no campaign id and no tracked API URL exist", () => {
    assert.throws(
      () =>
        resolveEbayAffiliateUrl({
          itemAffiliateWebUrl: productUrl,
          productUrl,
          customId: "radarcut-ebay-123456789",
        }),
      /AFFILIATE_URL/,
    );
  });

  it("uses a sandbox placeholder campaign when allowed", () => {
    const result = resolveEbayAffiliateUrl({
      itemAffiliateWebUrl: productUrl,
      productUrl,
      customId: "radarcut-ebay-123456789",
      allowSandboxPlaceholder: true,
    });
    assert.notEqual(result, productUrl);
    assert.match(result, /campid=sandbox/);
  });

  it("builds a documented EPN URL", () => {
    const url = buildEbayPartnerNetworkUrl({
      productUrl,
      campaignId: "5338123456",
      customId: "radarcut-product-abc",
    });
    assert.ok(url.startsWith("https://www.ebay.com/itm/123456789"));
    assert.match(url, /mkcid=1/);
  });
});
