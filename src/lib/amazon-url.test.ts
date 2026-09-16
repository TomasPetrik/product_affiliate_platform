import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  amazonAffiliateReferenceId,
  applyAmazonTrackingTag,
  extractAmazonAscSubtag,
  extractAmazonAsin,
  extractAmazonPartnerTag,
  generateAmazonTrackedAffiliate,
} from "@/lib/amazon-url";

describe("extractAmazonAsin", () => {
  it("returns a bare ASIN uppercased", () => {
    assert.equal(extractAmazonAsin("b08n5wrwnw"), "B08N5WRWNW");
  });

  it("parses /dp/ URLs", () => {
    assert.equal(
      extractAmazonAsin("https://www.amazon.com/dp/B08N5WRWNW?tag=radarcut-20"),
      "B08N5WRWNW",
    );
  });

  it("parses /gp/product/ URLs", () => {
    assert.equal(
      extractAmazonAsin("https://www.amazon.com/gp/product/B08N5WRWNW/ref=xx"),
      "B08N5WRWNW",
    );
  });

  it("returns null for non-Amazon URLs", () => {
    assert.equal(extractAmazonAsin("https://www.ebay.com/itm/123"), null);
  });
});

describe("extractAmazonPartnerTag / extractAmazonAscSubtag", () => {
  it("reads tag and ascsubtag query params", () => {
    const url =
      "https://www.amazon.com/dp/B08N5WRWNW?tag=radarcut-20&ascsubtag=radarcut-product-abc";
    assert.equal(extractAmazonPartnerTag(url), "radarcut-20");
    assert.equal(extractAmazonAscSubtag(url), "radarcut-product-abc");
  });

  it("returns null when missing", () => {
    assert.equal(extractAmazonPartnerTag("https://www.amazon.com/dp/B08N5WRWNW"), null);
    assert.equal(extractAmazonAscSubtag("https://www.amazon.com/dp/B08N5WRWNW"), null);
  });
});

describe("amazonAffiliateReferenceId", () => {
  it("prefers the RadarCut product id", () => {
    assert.equal(
      amazonAffiliateReferenceId({ productId: "clxyz123", asin: "B08N5WRWNW" }),
      "radarcut-product-clxyz123",
    );
  });

  it("falls back to the ASIN", () => {
    assert.equal(amazonAffiliateReferenceId({ asin: "B08N5WRWNW" }), "radarcut-amazon-B08N5WRWNW");
  });
});

describe("applyAmazonTrackingTag", () => {
  it("sets tag and ascsubtag", () => {
    const url = applyAmazonTrackingTag({
      url: "https://www.amazon.com/dp/B08N5WRWNW",
      partnerTag: "radarcut-20",
      customId: "radarcut-product-abc",
    });
    assert.match(url, /tag=radarcut-20/);
    assert.match(url, /ascsubtag=radarcut-product-abc/);
  });

  it("overwrites an existing tag", () => {
    const url = applyAmazonTrackingTag({
      url: "https://www.amazon.com/dp/B08N5WRWNW?tag=other-20",
      partnerTag: "radarcut-20",
    });
    assert.match(url, /tag=radarcut-20/);
    assert.doesNotMatch(url, /tag=other-20/);
  });
});

describe("generateAmazonTrackedAffiliate", () => {
  it("stores the unique ascsubtag as trackingTag, not the partner tag", () => {
    const result = generateAmazonTrackedAffiliate({
      asin: "B08N5WRWNW",
      partnerTag: "radarcut-20",
      productId: "prod1",
    });
    assert.equal(result.partnerTag, "radarcut-20");
    assert.equal(result.trackingTag, "radarcut-product-prod1");
    assert.equal(result.asin, "B08N5WRWNW");
    assert.match(result.affiliateUrl, /amazon\.com\/dp\/B08N5WRWNW/);
    assert.match(result.affiliateUrl, /tag=radarcut-20/);
    assert.match(result.affiliateUrl, /ascsubtag=radarcut-product-prod1/);
  });

  it("keeps an existing customId unless it equals the partner tag", () => {
    const kept = generateAmazonTrackedAffiliate({
      asin: "B08N5WRWNW",
      partnerTag: "radarcut-20",
      productId: "prod1",
      customId: "radarcut-amazon-B08N5WRWNW",
    });
    assert.equal(kept.trackingTag, "radarcut-amazon-B08N5WRWNW");

    const regenerated = generateAmazonTrackedAffiliate({
      asin: "B08N5WRWNW",
      partnerTag: "radarcut-20",
      productId: "prod1",
      customId: "radarcut-20",
    });
    assert.equal(regenerated.trackingTag, "radarcut-product-prod1");
  });

  it("throws when no URL or ASIN is provided", () => {
    assert.throws(
      () => generateAmazonTrackedAffiliate({ partnerTag: "radarcut-20" }),
      /Paste an Amazon product URL or ASIN/,
    );
  });
});
