import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createWanHistoryId,
  formatWanHistoryTime,
  sortWanHistoryNewestFirst,
  truncateWanPrompt,
  wanHistoryIdsToTrim,
  type WanHistoryEntry,
} from "./wan-image-edit-history";

function entry(partial: Partial<WanHistoryEntry> & Pick<WanHistoryEntry, "id" | "createdAt">): WanHistoryEntry {
  return {
    prompt: "p",
    size: "720*1280",
    seed: "",
    mainImage: { name: "a.jpg", type: "image/jpeg", blob: new Blob() },
    referenceImages: [],
    predictionId: "pred",
    status: "completed",
    outputs: [],
    source: "standalone",
    ...partial,
  };
}

describe("sortWanHistoryNewestFirst", () => {
  it("orders by createdAt descending", () => {
    const sorted = sortWanHistoryNewestFirst([
      entry({ id: "a", createdAt: "2026-01-01T10:00:00.000Z" }),
      entry({ id: "b", createdAt: "2026-01-02T10:00:00.000Z" }),
      entry({ id: "c", createdAt: "2026-01-01T12:00:00.000Z" }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item.id),
      ["b", "c", "a"],
    );
  });
});

describe("wanHistoryIdsToTrim", () => {
  it("returns oldest ids beyond max", () => {
    const newestFirst = [
      entry({ id: "1", createdAt: "2026-01-03T00:00:00.000Z" }),
      entry({ id: "2", createdAt: "2026-01-02T00:00:00.000Z" }),
      entry({ id: "3", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    assert.deepEqual(wanHistoryIdsToTrim(newestFirst, 2), ["3"]);
    assert.deepEqual(wanHistoryIdsToTrim(newestFirst, 5), []);
  });
});

describe("truncateWanPrompt / formatWanHistoryTime / createWanHistoryId", () => {
  it("truncates long prompts", () => {
    assert.equal(truncateWanPrompt("short"), "short");
    assert.equal(truncateWanPrompt("a".repeat(10), 8), "aaaaaaa…");
  });

  it("formats a valid ISO timestamp", () => {
    const formatted = formatWanHistoryTime("2026-03-15T14:30:00.000Z");
    assert.ok(formatted.length > 0);
    assert.notEqual(formatted, "2026-03-15T14:30:00.000Z");
  });

  it("creates a non-empty id", () => {
    assert.ok(createWanHistoryId().length > 0);
  });
});
