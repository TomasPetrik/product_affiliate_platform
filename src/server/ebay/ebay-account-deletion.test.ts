import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  ebayChallengeResponse,
  ebayNotificationEndpoint,
  parseEbayAccountDeletionPayload,
  parseEbaySignatureHeader,
} from "./ebay-account-deletion";

describe("ebay account deletion", () => {
  it("hashes challengeCode + token + endpoint in that order", () => {
    const expected = createHash("sha256")
      .update("challenge-1")
      .update("verification-token-value")
      .update("https://radarcut.com/api/ebay/marketplace-account-deletion")
      .digest("hex");

    assert.equal(
      ebayChallengeResponse(
        "challenge-1",
        "verification-token-value",
        "https://radarcut.com/api/ebay/marketplace-account-deletion",
      ),
      expected,
    );
  });

  it("parses a marketplace account deletion payload", () => {
    const notice = parseEbayAccountDeletionPayload({
      metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION" },
      notification: {
        notificationId: "n-1",
        data: { username: "exampleSeller", userId: "user-9" },
      },
    });

    assert.deepEqual(notice, {
      notificationId: "n-1",
      username: "exampleSeller",
      userId: "user-9",
    });
  });

  it("ignores unrelated notification topics", () => {
    assert.equal(
      parseEbayAccountDeletionPayload({
        metadata: { topic: "ITEM_PRICE_REVISION" },
        notification: { notificationId: "n-1", data: { username: "exampleSeller" } },
      }),
      null,
    );
  });

  it("decodes the x-ebay-signature header", () => {
    const header = Buffer.from(JSON.stringify({ kid: "key-1", signature: "sig-1" })).toString("base64");
    assert.deepEqual(parseEbaySignatureHeader(header), { kid: "key-1", signature: "sig-1" });
  });

  it("builds the public endpoint URL without a trailing slash", () => {
    assert.equal(
      ebayNotificationEndpoint("https://radarcut.com/", undefined),
      "https://radarcut.com/api/ebay/marketplace-account-deletion",
    );
  });
});
