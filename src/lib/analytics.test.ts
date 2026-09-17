import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyticsEventPayloadSchema, isBlockedAnalyticsPath, searchEventsForResultCount } from "./analytics";
import { analyticsRateLimitKey, consumeAnalyticsRateLimit, resetAnalyticsRateLimitForTests } from "./analytics-rate-limit";
import { affiliateOfferGoHref, parseLinkIdParam } from "./affiliate-go";
import { ADMIN_PROXY_MATCHER, isAdminAnalyticsPath } from "./admin-routes";

describe("analyticsEventPayloadSchema", () => {
  it("accepts a product view payload", () => {
    const parsed = analyticsEventPayloadSchema.safeParse({
      events: ["product_view"],
      productId: "clxyzproduct01",
      path: "/products/airpods-pro",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid product/offer ids that are too long", () => {
    const parsed = analyticsEventPayloadSchema.safeParse({
      productId: "x".repeat(80),
      affiliateLinkId: "y".repeat(80),
    });
    assert.equal(parsed.success, false);
  });
});

describe("isBlockedAnalyticsPath", () => {
  it("ignores admin and hop routes", () => {
    assert.equal(isBlockedAnalyticsPath("/admin/analytics"), true);
    assert.equal(isBlockedAnalyticsPath("/go/offer/abc"), true);
    assert.equal(isBlockedAnalyticsPath("/products/airpods-pro"), false);
  });
});

describe("searchEventsForResultCount", () => {
  it("records no_search_results for zero hits", () => {
    assert.deepEqual(searchEventsForResultCount(0), ["search", "no_search_results"]);
    assert.deepEqual(searchEventsForResultCount(3), ["search"]);
  });
});

describe("consumeAnalyticsRateLimit", () => {
  it("allows a burst then blocks", () => {
    resetAnalyticsRateLimitForTests();
    const key = analyticsRateLimitKey("visitor-1", "1.1.1.1");
    for (let i = 0; i < 60; i += 1) {
      assert.equal(consumeAnalyticsRateLimit(key, 1_000, 60, 60_000), true);
    }
    assert.equal(consumeAnalyticsRateLimit(key, 1_000, 60, 60_000), false);
  });
});

describe("admin analytics authorization", () => {
  it("covers analytics routes with the admin proxy matcher", () => {
    assert.deepEqual([...ADMIN_PROXY_MATCHER], ["/admin/:path*"]);
    assert.equal(isAdminAnalyticsPath("/admin/analytics"), true);
    assert.equal(isAdminAnalyticsPath("/admin/analytics/countries"), true);
    assert.equal(isAdminAnalyticsPath("/admin/analytics/countries/US"), true);
    assert.equal(isAdminAnalyticsPath("/products"), false);
  });
});

describe("affiliateOfferGoHref", () => {
  it("builds /go/offer/{id} and rejects junk ids", () => {
    assert.equal(affiliateOfferGoHref("cloffer123"), "/go/offer/cloffer123");
    assert.equal(parseLinkIdParam("../etc/passwd"), null);
    assert.equal(affiliateOfferGoHref("../etc/passwd"), "/");
  });
});
