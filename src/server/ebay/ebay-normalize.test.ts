import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeEbayItem, validateNormalizedListing, type EbayBrowseItem } from "./ebay-normalize";

function sampleItem(overrides: Partial<EbayBrowseItem> = {}): EbayBrowseItem {
  return {
    itemId: "v1|123456789|0",
    legacyItemId: "123456789",
    title: "Sony WH-1000XM5 Wireless Headphones",
    shortDescription: "Industry-leading noise cancellation",
    description: "<p>Wireless headphones</p>",
    price: { value: "249.99", currency: "USD" },
    marketingPrice: { originalPrice: { value: "399.99", currency: "USD" } },
    image: { imageUrl: "https://i.ebayimg.com/images/g/example/s-l1600.jpg" },
    itemWebUrl: "https://www.ebay.com/itm/123456789",
    itemAffiliateWebUrl: "https://www.ebay.com/itm/123456789?campid=1",
    condition: "New",
    brand: "Sony",
    gtin: "0027242921090",
    seller: { username: "ExampleSeller" },
    estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }],
    localizedAspects: [
      { name: "Brand", value: "Sony" },
      { name: "Model", value: "WH-1000XM5" },
      { name: "MPN", value: "WH1000XM5" },
    ],
    ...overrides,
  };
}

describe("normalizeEbayItem", () => {
  it("maps Browse API fields onto a retailer-agnostic listing", () => {
    const listing = normalizeEbayItem(sampleItem());
    assert.equal(listing.itemId, "123456789");
    assert.equal(listing.price, 249.99);
    assert.equal(listing.originalPrice, 399.99);
    assert.equal(listing.brand, "Sony");
    assert.equal(listing.modelNumber, "WH-1000XM5");
    assert.equal(listing.gtin, "0027242921090");
    assert.equal(listing.sellerName, "ExampleSeller");
    assert.equal(listing.ended, false);
  });

  it("collects the full listing gallery, not only the primary photo", () => {
    const listing = normalizeEbayItem(
      sampleItem({
        additionalImages: [
          { imageUrl: "https://i.ebayimg.com/images/g/aaaa/s-l1600.jpg" },
          { imageUrl: "https://i.ebayimg.com/images/g/bbbb/s-l1600.jpg" },
          { imageUrl: "https://i.ebayimg.com/images/g/example/s-l64.jpg" },
        ],
        product: {
          additionalImages: [{ imageUrl: "https://i.ebayimg.com/images/g/cccc/s-l1600.jpg" }],
        },
      }),
    );

    assert.equal(listing.imageUrl, "https://i.ebayimg.com/images/g/example/s-l1600.jpg");
    assert.deepEqual(listing.additionalImageUrls, [
      "https://i.ebayimg.com/images/g/aaaa/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/bbbb/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/cccc/s-l1600.jpg",
    ]);
  });

  it("rejects missing title, price, and image", () => {
    assert.throws(
      () => validateNormalizedListing(normalizeEbayItem(sampleItem({ title: "" }))),
      /MISSING_TITLE/,
    );
    assert.throws(
      () => validateNormalizedListing(normalizeEbayItem(sampleItem({ price: undefined, currentBidPrice: undefined }))),
      /MISSING_PRICE/,
    );
    assert.throws(
      () => validateNormalizedListing(normalizeEbayItem(sampleItem({ image: {}, additionalImages: [] }))),
      /MISSING_IMAGE/,
    );
  });

  it("rejects ended listings", () => {
    assert.throws(
      () =>
        validateNormalizedListing(
          normalizeEbayItem(
            sampleItem({
              estimatedAvailabilities: [{ estimatedAvailabilityStatus: "OUT_OF_STOCK" }],
            }),
          ),
        ),
      /UNAVAILABLE/,
    );
  });
});
