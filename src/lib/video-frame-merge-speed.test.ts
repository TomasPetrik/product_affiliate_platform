import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampMergeClipSpeed,
  ffmpegAtempoFilter,
  mergeClipTimelineDurationSec,
} from "@/lib/video-frame-merge-speed";

describe("clampMergeClipSpeed", () => {
  it("clamps to 0.5–4 and defaults invalid values to 1", () => {
    assert.equal(clampMergeClipSpeed(0.25), 0.5);
    assert.equal(clampMergeClipSpeed(8), 4);
    assert.equal(clampMergeClipSpeed(Number.NaN), 1);
    assert.equal(clampMergeClipSpeed(undefined), 1);
    assert.equal(clampMergeClipSpeed(1.5), 1.5);
  });
});

describe("mergeClipTimelineDurationSec", () => {
  it("shortens timeline when faster, lengthens when slower", () => {
    assert.equal(mergeClipTimelineDurationSec(0, 4, 2), 2);
    assert.equal(mergeClipTimelineDurationSec(0, 4, 0.5), 8);
    assert.equal(mergeClipTimelineDurationSec(1, 5, 1), 4);
  });
});

describe("ffmpegAtempoFilter", () => {
  it("returns null at 1×", () => {
    assert.equal(ffmpegAtempoFilter(1), null);
  });

  it("chains atempo for 4× and uses a single filter for 0.5×", () => {
    assert.equal(ffmpegAtempoFilter(4), "atempo=2,atempo=2");
    assert.equal(ffmpegAtempoFilter(0.5), "atempo=0.5");
    assert.equal(ffmpegAtempoFilter(1.5), "atempo=1.5");
  });
});
