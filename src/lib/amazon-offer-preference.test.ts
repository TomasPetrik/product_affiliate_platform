import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  amazonIsCheapestAmongOffers,
  filterOffersByAmazonPreference,
} from "@/lib/amazon-offer-preference";

describe("amazonIsCheapestAmongOffers", () => {
  it("returns false when no priced offers exist", () => {
    assert.equal(amazonIsCheapestAmongOffers([{ marketplace: "AMAZON", price: null }]), false);
    assert.equal(amazonIsCheapestAmongOffers([]), false);
  });

  it("returns true when Amazon has the lowest price", () => {
    assert.equal(
      amazonIsCheapestAmongOffers([
        { marketplace: "AMAZON", price: 19.99 },
        { marketplace: "EBAY", price: 24.5 },
      ]),
      true,
    );
  });

  it("returns true on a price tie with Amazon", () => {
    assert.equal(
      amazonIsCheapestAmongOffers([
        { marketplace: "EBAY", price: 20 },
        { marketplace: "AMAZON", price: 20 },
      ]),
      true,
    );
  });

  it("returns false when another retailer is cheaper", () => {
    assert.equal(
      amazonIsCheapestAmongOffers([
        { marketplace: "AMAZON", price: 30 },
        { marketplace: "EBAY", price: 18 },
      ]),
      false,
    );
  });
});

describe("filterOffersByAmazonPreference", () => {
  const offers = [
    { id: "a", marketplace: "AMAZON", price: 22 },
    { id: "e", marketplace: "EBAY", price: 25 },
  ];

  it("returns all offers when both flags are off", () => {
    assert.deepEqual(
      filterOffersByAmazonPreference(offers, {
        preferAmazonWhenCheapest: false,
        forceAmazonOnly: false,
      }),
      offers,
    );
  });

  it("keeps only Amazon when it is cheapest and prefer flag is on", () => {
    assert.deepEqual(
      filterOffersByAmazonPreference(offers, {
        preferAmazonWhenCheapest: true,
        forceAmazonOnly: false,
      }),
      [offers[0]],
    );
  });

  it("keeps all offers when prefer is on but Amazon is not cheapest", () => {
    const ebayCheaper = [
      { id: "a", marketplace: "AMAZON", price: 30 },
      { id: "e", marketplace: "EBAY", price: 18 },
    ];
    assert.deepEqual(
      filterOffersByAmazonPreference(ebayCheaper, {
        preferAmazonWhenCheapest: true,
        forceAmazonOnly: false,
      }),
      ebayCheaper,
    );
  });

  it("force Amazon only hides other retailers even when they are cheaper", () => {
    const ebayCheaper = [
      { id: "a", marketplace: "AMAZON", price: 30 },
      { id: "e", marketplace: "EBAY", price: 18 },
    ];
    assert.deepEqual(
      filterOffersByAmazonPreference(ebayCheaper, {
        preferAmazonWhenCheapest: false,
        forceAmazonOnly: true,
      }),
      [ebayCheaper[0]],
    );
  });

  it("force Amazon only wins over prefer when both are on", () => {
    const ebayOnlyCheaper = [
      { id: "a", marketplace: "AMAZON", price: 40 },
      { id: "e", marketplace: "EBAY", price: 10 },
    ];
    assert.deepEqual(
      filterOffersByAmazonPreference(ebayOnlyCheaper, {
        preferAmazonWhenCheapest: true,
        forceAmazonOnly: true,
      }),
      [ebayOnlyCheaper[0]],
    );
  });
});
