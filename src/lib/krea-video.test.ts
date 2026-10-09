import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampKreaDuration,
  DEFAULT_KREA_VIDEO_MODEL_ID,
  DEFAULT_SPAN_CLIP_MODEL_ID,
  durationChoicesForModel,
  estimateKreaVideoProgressPercent,
  getKreaVideoModel,
  isKreaCompleted,
  isKreaTerminalFailure,
  kreaVideoSubmitUrl,
  randomKreaSeed,
  suggestedKreaDurationFromTimes,
  KREA_SEED_MAX,
} from "./krea-video";

describe("krea video models", () => {
  it("defaults to Seedance 2.5", () => {
    const model = getKreaVideoModel(DEFAULT_KREA_VIDEO_MODEL_ID);
    assert.ok(model);
    assert.equal(model?.path, "bytedance/seedance-2-5");
    assert.equal(
      kreaVideoSubmitUrl(model!.path),
      "https://api.krea.ai/generate/video/bytedance/seedance-2-5",
    );
  });

  it("clamps duration and respects fixed options", () => {
    const seedance = getKreaVideoModel("seedance-2-5")!;
    assert.equal(clampKreaDuration(seedance, 2), 4);
    assert.equal(clampKreaDuration(seedance, 99), 30);

    const shortClip = getKreaVideoModel("seedance-1.0-pro-fast")!;
    assert.equal(clampKreaDuration(shortClip, 2), 2);
    assert.equal(shortClip.durationMin, 2);

    const hailuo = getKreaVideoModel("hailuo-2.3")!;
    assert.equal(clampKreaDuration(hailuo, 7), hailuo.defaultDuration);
    assert.deepEqual(durationChoicesForModel(hailuo), [6, 10]);
  });

  it("suggests span clip duration from first/last frame delta", () => {
    const model = getKreaVideoModel(DEFAULT_SPAN_CLIP_MODEL_ID)!;
    assert.equal(suggestedKreaDurationFromTimes([1.0, 3.2], model), 2);
    assert.equal(suggestedKreaDurationFromTimes([0, 5.4], model), 5);
    assert.equal(suggestedKreaDurationFromTimes([2], model), model.defaultDuration);
  });
});

describe("krea job helpers", () => {
  it("detects completed and terminal failures", () => {
    assert.equal(isKreaCompleted("completed"), true);
    assert.equal(isKreaTerminalFailure("failed"), true);
    assert.equal(isKreaTerminalFailure("processing"), false);
  });

  it("estimates progress from API and phase", () => {
    assert.equal(
      estimateKreaVideoProgressPercent({
        status: "processing",
        startedAt: Date.now(),
        apiProgress: 0.4,
        phase: "polling",
      }),
      40,
    );
    assert.equal(
      estimateKreaVideoProgressPercent({
        status: "completed",
        startedAt: Date.now() - 10_000,
        phase: "completed",
      }),
      100,
    );
  });

  it("random seed stays in range", () => {
    const seed = randomKreaSeed(() => 0.999);
    assert.ok(seed >= 0 && seed < KREA_SEED_MAX);
  });
});
