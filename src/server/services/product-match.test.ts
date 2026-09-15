import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchProductIdentifiers } from "./product-match";

describe("matchProductIdentifiers", () => {
  const catalog = [
    { id: "p1", gtin: "0027242921090", mpn: "WH1000XM5", brand: "Sony", modelNumber: "WH-1000XM5" },
    { id: "p2", gtin: "111", mpn: "OTHER", brand: "Bose", modelNumber: "QC45" },
  ];

  it("matches on GTIN", () => {
    const matches = matchProductIdentifiers({ gtin: "0027242921090" }, catalog);
    assert.deepEqual(matches, [{ id: "p1", reason: "gtin" }]);
  });

  it("matches on brand + MPN", () => {
    const matches = matchProductIdentifiers({ brand: "Sony", mpn: "WH1000XM5" }, catalog);
    assert.deepEqual(matches, [{ id: "p1", reason: "mpn" }]);
  });

  it("matches on brand + model", () => {
    const matches = matchProductIdentifiers({ brand: "Sony", modelNumber: "WH-1000XM5" }, catalog);
    assert.deepEqual(matches, [{ id: "p1", reason: "brand_model" }]);
  });

  it("does not match on similar titles / weak tokens", () => {
    const matches = matchProductIdentifiers({ brand: "Sony", modelNumber: "WH" }, catalog);
    assert.deepEqual(matches, []);
  });
});
