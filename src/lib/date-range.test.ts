import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDateRange } from "./date-range";

describe("resolveDateRange", () => {
  it("supports yesterday as a closed UTC day", () => {
    const range = resolveDateRange({ range: "yesterday" });
    assert.equal(range.preset, "yesterday");
    assert.equal(range.end.getTime() - range.start.getTime(), 24 * 60 * 60 * 1000 - 1);
  });

  it("defaults to last 30 days", () => {
    const range = resolveDateRange({});
    assert.equal(range.preset, "30d");
  });
});
