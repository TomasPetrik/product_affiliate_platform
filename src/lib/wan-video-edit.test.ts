import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampWanVideoEditDuration,
  suggestedWanVideoEditDuration,
  WAN_VIDEO_EDIT_DURATION_MAX,
  WAN_VIDEO_EDIT_DURATION_MIN,
  WAN_VIDEO_EDIT_MODEL,
} from "./wan-video-edit";

describe("wan video edit helpers", () => {
  it("uses the WaveSpeed video-edit model id", () => {
    assert.equal(WAN_VIDEO_EDIT_MODEL, "alibaba/wan-3.0/video-edit");
  });

  it("clamps duration to 2–15 or null for auto", () => {
    assert.equal(clampWanVideoEditDuration(null), null);
    assert.equal(clampWanVideoEditDuration(undefined), null);
    assert.equal(clampWanVideoEditDuration(Number.NaN), null);
    assert.equal(clampWanVideoEditDuration(1), WAN_VIDEO_EDIT_DURATION_MIN);
    assert.equal(clampWanVideoEditDuration(99), WAN_VIDEO_EDIT_DURATION_MAX);
    assert.equal(clampWanVideoEditDuration(5.4), 5);
  });

  it("suggests duration from cut range", () => {
    assert.equal(suggestedWanVideoEditDuration(4, 6), 2);
    assert.equal(suggestedWanVideoEditDuration(0, 12.6), 13);
    assert.equal(suggestedWanVideoEditDuration(0, 20), WAN_VIDEO_EDIT_DURATION_MAX);
  });
});
