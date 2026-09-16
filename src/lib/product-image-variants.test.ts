import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLocalProductUpload,
  productImageVariantPath,
  productListImageUrl,
  productThumbImageUrl,
} from "./product-image-variants";

describe("productImageVariantPath", () => {
  it("leaves remote URLs unchanged", () => {
    const remote = "https://i.ebayimg.com/images/g/abc/s-l1600.jpg";
    assert.equal(productImageVariantPath(remote, "sm"), remote);
    assert.equal(productListImageUrl(remote), remote);
  });

  it("derives sm/md siblings for local uploads", () => {
    const full = "/uploads/products/123-abcdef.webp";
    assert.equal(productImageVariantPath(full, "full"), full);
    assert.equal(productImageVariantPath(full, "sm"), "/uploads/products/123-abcdef-sm.webp");
    assert.equal(productImageVariantPath(full, "md"), "/uploads/products/123-abcdef-md.webp");
    assert.equal(productThumbImageUrl(full), "/uploads/products/123-abcdef-sm.webp");
    assert.equal(productListImageUrl(full), "/uploads/products/123-abcdef-md.webp");
  });

  it("normalizes an already-variant path before deriving another", () => {
    assert.equal(
      productImageVariantPath("/uploads/products/123-abcdef-sm.webp", "md"),
      "/uploads/products/123-abcdef-md.webp",
    );
  });

  it("rejects traversal-looking local paths", () => {
    assert.equal(isLocalProductUpload("/uploads/products/../secret.webp"), false);
  });
});
