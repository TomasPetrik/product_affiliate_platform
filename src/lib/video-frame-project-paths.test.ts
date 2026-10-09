import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatByteSize,
  isLocalVideoFrameUpload,
  publicVideoFramePath,
} from "./video-frame-project-paths";

describe("formatByteSize", () => {
  it("formats bytes through megabytes", () => {
    assert.equal(formatByteSize(512), "512 B");
    assert.equal(formatByteSize(2048), "2 KB");
    assert.equal(formatByteSize(5 * 1024 * 1024), "5.0 MB");
  });
});

describe("video frame paths", () => {
  it("builds public paths and rejects traversal", () => {
    assert.equal(
      publicVideoFramePath("proj1", "frames/a.jpg"),
      "/uploads/video-frames/proj1/frames/a.jpg",
    );
    assert.equal(isLocalVideoFrameUpload("/uploads/video-frames/proj1/source.mp4"), true);
    assert.equal(isLocalVideoFrameUpload("/uploads/video-frames/../secret"), false);
  });
});
