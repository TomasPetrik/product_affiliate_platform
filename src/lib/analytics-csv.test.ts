import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canReadAnalytics, isAnalyticsExportType, toCsv } from "@/lib/analytics-csv";

describe("canReadAnalytics", () => {
  it("denies missing admin sessions", () => {
    assert.equal(canReadAnalytics(null), false);
    assert.equal(canReadAnalytics(undefined), false);
    assert.equal(canReadAnalytics({ sub: "admin_1" }), true);
  });
});

describe("isAnalyticsExportType", () => {
  it("allows the documented export types", () => {
    assert.equal(isAnalyticsExportType("products"), true);
    assert.equal(isAnalyticsExportType("clicks"), true);
    assert.equal(isAnalyticsExportType("countries"), true);
    assert.equal(isAnalyticsExportType("campaigns"), true);
    assert.equal(isAnalyticsExportType("secret"), false);
  });
});

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    assert.equal(toCsv(["name"], [['AirPods, "Pro"']]), 'name\n"AirPods, ""Pro"""');
  });
});
