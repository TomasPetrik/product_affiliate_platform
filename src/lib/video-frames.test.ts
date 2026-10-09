import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampSpan,
  createZipBlob,
  formatVideoTime,
  previewTimeKey,
  timestampsForSpan,
  totalFrameCount,
  uniquePreviewTimes,
} from "./video-frames";

describe("timestampsForSpan", () => {
  it("returns first and last for two frames", () => {
    assert.deepEqual(timestampsForSpan(0, 2, 2), [0, 2]);
  });

  it("spaces frames evenly including ends", () => {
    assert.deepEqual(timestampsForSpan(2, 4, 5), [2, 2.5, 3, 3.5, 4]);
  });

  it("returns start for a single frame", () => {
    assert.deepEqual(timestampsForSpan(1, 3, 1), [1]);
  });
});

describe("formatVideoTime", () => {
  it("formats minutes, seconds, and tenths", () => {
    assert.equal(formatVideoTime(65.25), "1:05.2");
  });
});

describe("clampSpan / totalFrameCount", () => {
  it("clamps bounds and counts", () => {
    const span = clampSpan(
      { id: "a", start: -1, end: 99, frameCount: 200 },
      10,
    );
    assert.equal(span.start, 0);
    assert.equal(span.end, 10);
    assert.equal(span.frameCount, 120);
    assert.equal(totalFrameCount([span]), 120);
  });
});

describe("createZipBlob", () => {
  it("builds a readable zip signature", async () => {
    const data = new TextEncoder().encode("hello");
    const blob = createZipBlob([{ name: "a.txt", data }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);
  });
});

describe("preview helpers", () => {
  it("rounds preview cache keys to slider step", () => {
    assert.equal(previewTimeKey(1.24), "1.2");
    assert.equal(previewTimeKey(1.26), "1.3");
  });

  it("dedupes planned preview times across spans", () => {
    assert.deepEqual(
      uniquePreviewTimes([
        { id: "a", start: 0, end: 2, frameCount: 2 },
        { id: "b", start: 2, end: 4, frameCount: 3 },
      ]),
      [0, 2, 3, 4],
    );
  });
});
