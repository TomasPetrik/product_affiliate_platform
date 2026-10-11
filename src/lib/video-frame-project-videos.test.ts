import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findProjectSourceVideo,
  legacyProjectSourceVideos,
  parseProjectSourceVideos,
  primaryVideoColumns,
  resolveProjectVideos,
  totalProjectVideoBytes,
} from "./video-frame-project-videos";
import { spansForVideo } from "./video-frames";

describe("parseProjectSourceVideos", () => {
  it("keeps valid rows and drops invalid ones", () => {
    const videos = parseProjectSourceVideos([
      {
        id: "a",
        fileName: "one.mp4",
        mimeType: "video/mp4",
        path: "/uploads/video-frames/p/sources/a.mp4",
        bytes: 100,
        durationSec: 12.5,
        width: 1920,
        height: 1080,
      },
      { id: "bad" },
    ]);
    assert.equal(videos.length, 1);
    assert.equal(videos[0]?.id, "a");
    assert.equal(videos[0]?.durationSec, 12.5);
  });
});

describe("resolveProjectVideos", () => {
  it("falls back to legacy columns when videosJson is empty", () => {
    const videos = resolveProjectVideos({
      videosJson: [],
      videoPath: "/uploads/video-frames/p/source.mp4",
      videoFileName: "clip.mp4",
      videoMimeType: "video/mp4",
      videoBytes: 50,
      durationSec: 8,
      videoWidth: 1280,
      videoHeight: 720,
    });
    assert.equal(videos.length, 1);
    assert.equal(videos[0]?.id, "legacy-source");
    assert.equal(videos[0]?.fileName, "clip.mp4");
  });
});

describe("findProjectSourceVideo / primaryVideoColumns", () => {
  const videos = legacyProjectSourceVideos({
    videoPath: "/uploads/video-frames/p/source.mp4",
    videoFileName: "a.mp4",
    videoMimeType: null,
    videoBytes: 10,
    durationSec: 5,
    videoWidth: null,
    videoHeight: null,
  }).concat([
    {
      id: "vid-2",
      fileName: "b.mp4",
      mimeType: null,
      path: "/uploads/video-frames/p/sources/vid-2.mp4",
      bytes: 20,
      durationSec: 9,
      width: null,
      height: null,
    },
  ]);

  it("resolves by id and falls back to primary", () => {
    assert.equal(findProjectSourceVideo(videos, "vid-2")?.fileName, "b.mp4");
    assert.equal(findProjectSourceVideo(videos, "missing")?.id, "legacy-source");
  });

  it("sums bytes and uses first video as primary columns", () => {
    assert.equal(totalProjectVideoBytes(videos), 30);
    const primary = primaryVideoColumns(videos);
    assert.equal(primary.videoFileName, "a.mp4");
    assert.equal(primary.videoBytes, BigInt(30));
    assert.equal(primary.durationSec, 5);
  });
});

describe("spansForVideo", () => {
  it("matches explicit videoId and treats missing as primary", () => {
    const spans = [
      { id: "s1", start: 0, end: 1, frameCount: 2, videoId: "v1" },
      { id: "s2", start: 0, end: 1, frameCount: 2 },
      { id: "s3", start: 0, end: 1, frameCount: 2, videoId: "v2" },
      { id: "c1", start: 0, end: 0, frameCount: 1, kind: "custom" as const },
    ];
    assert.deepEqual(
      spansForVideo(spans, "v1", "v1").map((span) => span.id),
      ["s1", "s2"],
    );
    assert.deepEqual(
      spansForVideo(spans, "v2", "v1").map((span) => span.id),
      ["s3"],
    );
  });
});
