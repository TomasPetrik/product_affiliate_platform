import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WAN_SIZE,
  isWanCompleted,
  isWanTerminalFailure,
  randomWanSeed,
  unwrapWaveSpeedData,
  validateWanSize,
  wavespeedResultUrl,
  WAN_SEED_MAX,
} from "./wan-image-edit";

describe("validateWanSize", () => {
  it("accepts default 9:16 preset", () => {
    assert.equal(validateWanSize(DEFAULT_WAN_SIZE), null);
    assert.equal(validateWanSize("1080*1920"), null);
  });

  it("rejects malformed or out-of-range sizes", () => {
    assert.match(validateWanSize("720x1280") ?? "", /width\*height/);
    assert.match(validateWanSize("100*100") ?? "", /512/);
    assert.match(validateWanSize("4096*4096") ?? "", /Total pixels/);
  });
});

describe("prediction status helpers", () => {
  it("detects completed and terminal failures", () => {
    assert.equal(isWanCompleted("completed"), true);
    assert.equal(isWanTerminalFailure("failed"), true);
    assert.equal(isWanTerminalFailure("processing"), false);
  });
});

describe("unwrapWaveSpeedData", () => {
  it("unwraps data envelope or returns bare payload", () => {
    assert.deepEqual(unwrapWaveSpeedData({ data: { id: "abc" } }), { id: "abc" });
    assert.deepEqual(unwrapWaveSpeedData({ id: "abc" }), { id: "abc" });
  });
});

describe("wavespeedResultUrl", () => {
  it("builds the poll URL", () => {
    assert.equal(
      wavespeedResultUrl("pred_1"),
      "https://api.wavespeed.ai/api/v3/predictions/pred_1/result",
    );
  });
});

describe("randomWanSeed", () => {
  it("returns a non-negative integer within range", () => {
    const seed = randomWanSeed(() => 0.5);
    assert.equal(seed, Math.floor(0.5 * WAN_SEED_MAX));
    assert.ok(seed >= 0 && seed < WAN_SEED_MAX);
  });
});
