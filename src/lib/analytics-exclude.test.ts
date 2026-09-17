import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isExcludedAnalyticsVisitor, parseExcludedCountries, parseExcludedIps } from "./analytics-exclude";

describe("parseExcludedIps", () => {
  it("keeps public addresses and drops private ones", () => {
    const ips = parseExcludedIps("188.167.255.194, 127.0.0.1, ::ffff:8.8.8.8");
    assert.equal(ips.has("188.167.255.194"), true);
    assert.equal(ips.has("8.8.8.8"), true);
    assert.equal(ips.has("127.0.0.1"), false);
  });
});

describe("parseExcludedCountries", () => {
  it("normalizes ISO country codes", () => {
    const countries = parseExcludedCountries("sk, US, xx");
    assert.deepEqual([...countries].sort(), ["SK", "US"]);
  });
});

describe("isExcludedAnalyticsVisitor", () => {
  it("matches an excluded IP regardless of country", () => {
    assert.equal(
      isExcludedAnalyticsVisitor({ ip: "188.167.255.194", country: "SK" }, { ips: ["188.167.255.194"] }),
      true,
    );
    assert.equal(
      isExcludedAnalyticsVisitor({ ip: "8.8.8.8", country: "US" }, { ips: ["188.167.255.194"] }),
      false,
    );
  });

  it("matches an excluded country", () => {
    assert.equal(isExcludedAnalyticsVisitor({ ip: "8.8.8.8", country: "sk" }, { countries: ["SK"] }), true);
    assert.equal(isExcludedAnalyticsVisitor({ ip: "8.8.8.8", country: "US" }, { countries: ["SK"] }), false);
  });
});
