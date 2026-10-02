import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCommentAutoReplyBody,
  commentContainsKeyword,
} from "@/server/services/comment-auto-reply.helpers";
import { parseMetaCommentWebhookPayload } from "@/server/services/meta-comment-webhook.parse";

describe("commentContainsKeyword", () => {
  it("matches case-insensitive substrings", () => {
    assert.equal(commentContainsKeyword("give me the LINK please", "link"), true);
    assert.equal(commentContainsKeyword("price?", "PRICE"), true);
    assert.equal(commentContainsKeyword("hello", "link"), false);
  });
});

describe("buildCommentAutoReplyBody", () => {
  it("joins message and url with a space", () => {
    assert.equal(
      buildCommentAutoReplyBody("Here’s the product:", "https://radarcut.com/p/42"),
      "Here’s the product: https://radarcut.com/p/42",
    );
  });
});

describe("parseMetaCommentWebhookPayload", () => {
  it("parses Instagram comment webhooks", () => {
    const events = parseMetaCommentWebhookPayload({
      object: "instagram",
      entry: [
        {
          id: "17841400000",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_1",
                text: "give me the LINK please",
                media: { id: "18000000000" },
                from: { id: "user_1", username: "buyer" },
              },
            },
          ],
        },
      ],
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.platform, "INSTAGRAM");
    assert.equal(events[0]?.commentId, "comment_1");
    assert.equal(events[0]?.mediaExternalId, "18000000000");
    assert.equal(events[0]?.isTopLevel, true);
  });

  it("parses Facebook Page feed comment webhooks", () => {
    const events = parseMetaCommentWebhookPayload({
      object: "page",
      entry: [
        {
          id: "page_1",
          changes: [
            {
              field: "feed",
              value: {
                item: "comment",
                verb: "add",
                comment_id: "cmt_fb_1",
                post_id: "page_1_999",
                parent_id: "page_1_999",
                video_id: "999",
                message: "need the LINK",
                from: { id: "user_2", name: "Buyer" },
              },
            },
          ],
        },
      ],
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.platform, "FACEBOOK");
    assert.equal(events[0]?.commentId, "cmt_fb_1");
    assert.ok(events[0]?.mediaIdCandidates.includes("999"));
    assert.equal(events[0]?.isTopLevel, true);
  });

  it("marks nested Facebook comments as not top-level", () => {
    const events = parseMetaCommentWebhookPayload({
      object: "page",
      entry: [
        {
          changes: [
            {
              field: "feed",
              value: {
                item: "comment",
                verb: "add",
                comment_id: "cmt_nested",
                post_id: "page_1_999",
                parent_id: "cmt_parent",
                message: "LINK",
              },
            },
          ],
        },
      ],
    });

    assert.equal(events[0]?.isTopLevel, false);
  });
});
