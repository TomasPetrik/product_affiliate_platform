import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampWanVideoDuration,
  preferredWanVideoAspect,
  suggestedWanVideoDurationFromTimes,
  WAN_REFERENCE_TO_VIDEO_MODEL,
  WAN_VIDEO_DURATION_MAX,
  WAN_VIDEO_DURATION_MIN,
} from "./wan-video";

describe("wan video helpers", () => {
  it("uses the WaveSpeed reference-to-video model id", () => {
    assert.equal(WAN_REFERENCE_TO_VIDEO_MODEL, "alibaba/wan-3.0/reference-to-video");
  });

  it("clamps duration to 2–30", () => {
    assert.equal(clampWanVideoDuration(1), WAN_VIDEO_DURATION_MIN);
    assert.equal(clampWanVideoDuration(99), WAN_VIDEO_DURATION_MAX);
    assert.equal(clampWanVideoDuration(5.4), 5);
  });

  it("suggests duration from frame delta", () => {
    assert.equal(suggestedWanVideoDurationFromTimes([1.0, 3.2]), 2);
    assert.equal(suggestedWanVideoDurationFromTimes([0, 12.6]), 13);
  });

  it("prefers portrait aspect for tall videos", () => {
    assert.equal(preferredWanVideoAspect(9 / 16), "9:16");
    assert.equal(preferredWanVideoAspect(16 / 9), "16:9");
  });
});
