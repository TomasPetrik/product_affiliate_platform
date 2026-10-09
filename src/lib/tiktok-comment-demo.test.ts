import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  simulateTikTokKeywordMatch,
  type TikTokCommentDemoProduct,
} from "@/lib/tiktok-comment-demo";

const sampleProduct: TikTokCommentDemoProduct = {
  id: "prod_1",
  title: "Portable Printer",
  slug: "portable-printer",
  publicId: 42,
  productUrl: "https://radarcut.com/p/42",
  hopUrl: "https://radarcut.com/go/portable-printer",
  tiktokAccountHint: "RadarCut Finds",
  rules: [
    {
      id: "rule_1",
      keyword: "LINK",
      publicReplyMessage: "Just sent you a DM with the link ✨",
      dmReplyMessage: "Enjoy ✨😊",
      replyUrl: "https://radarcut.com/go/portable-printer",
      enablePublicReply: true,
      enablePrivateDm: true,
      isActive: true,
    },
  ],
  linkedTikTokPosts: [],
};

describe("simulateTikTokKeywordMatch", () => {
  it("matches LINK and builds reply + DM with product hop", () => {
    const result = simulateTikTokKeywordMatch(sampleProduct, "Please send LINK");
    assert.equal(result.matched, true);
    assert.equal(result.productTitle, "Portable Printer");
    assert.equal(result.keyword, "LINK");
    assert.equal(result.publicReply, "Just sent you a DM with the link ✨");
    assert.equal(result.dmReply, "Enjoy ✨😊 https://radarcut.com/go/portable-printer");
  });

  it("does not match unrelated comments", () => {
    const result = simulateTikTokKeywordMatch(sampleProduct, "nice video");
    assert.equal(result.matched, false);
  });
});
