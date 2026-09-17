import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cityFromHeaders,
  clientIpFromHeaders,
  countryFromHeaders,
  isPublicClientIp,
  languageFromHeaders,
  lookupGeoFromIp,
  normalizeCountryCode,
  parseCountryPathParam,
  regionFromHeaders,
  resolveVisitorGeo,
} from "./geo";

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe("countryFromHeaders", () => {
  it("reads CDN country headers without asking the browser", () => {
    assert.equal(countryFromHeaders(headers({ "cf-ipcountry": "us" })), "US");
    assert.equal(countryFromHeaders(headers({ "x-vercel-ip-country": "CA" })), "CA");
    assert.equal(countryFromHeaders(headers({ "cf-ipcountry": "XX" })), null);
  });
});

describe("regionFromHeaders", () => {
  it("accepts a region code and rejects junk", () => {
    assert.equal(regionFromHeaders(headers({ "x-vercel-ip-country-region": "ca" })), "CA");
    assert.equal(regionFromHeaders(headers({ "cf-region-code": "not a region!!" })), null);
  });
});

describe("cityFromHeaders", () => {
  it("decodes a CDN city and rejects junk", () => {
    assert.equal(cityFromHeaders(headers({ "x-vercel-ip-city": "New%20York" })), "New York");
    assert.equal(cityFromHeaders(headers({ "cf-ipcity": "<script>" })), null);
  });
});

describe("languageFromHeaders", () => {
  it("takes the first Accept-Language tag", () => {
    assert.equal(languageFromHeaders(headers({ "accept-language": "en-US,en;q=0.9" })), "en-US");
  });
});

describe("normalizeCountryCode", () => {
  it("rejects invalid codes", () => {
    assert.equal(normalizeCountryCode("USA"), null);
    assert.equal(normalizeCountryCode("gb"), "GB");
  });
});

describe("parseCountryPathParam", () => {
  it("accepts ISO codes and the unknown bucket", () => {
    assert.equal(parseCountryPathParam("de"), "DE");
    assert.equal(parseCountryPathParam("unknown"), "unknown");
    assert.equal(parseCountryPathParam("germany"), null);
  });
});

describe("isPublicClientIp", () => {
  it("rejects loopback and private ranges", () => {
    assert.equal(isPublicClientIp("127.0.0.1"), false);
    assert.equal(isPublicClientIp("10.0.0.8"), false);
    assert.equal(isPublicClientIp("192.168.1.1"), false);
    assert.equal(isPublicClientIp("::1"), false);
    assert.equal(isPublicClientIp("8.8.8.8"), true);
    assert.equal(isPublicClientIp("::ffff:8.8.8.8"), true);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers X-Real-IP over a spoofed X-Forwarded-For prefix", () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-real-ip": "203.0.113.10", "x-forwarded-for": "8.8.8.8, 203.0.113.10" })),
      "203.0.113.10",
    );
  });

  it("uses the rightmost public X-Forwarded-For hop", () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "8.8.8.8, 203.0.113.10" })),
      "203.0.113.10",
    );
  });

  it("ignores private proxy hops", () => {
    assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.10, 127.0.0.1" })), "203.0.113.10");
  });
});

describe("lookupGeoFromIp", () => {
  it("does not look up private addresses", () => {
    assert.deepEqual(
      lookupGeoFromIp("127.0.0.1", () => ({ country: "US", region: "NY", city: "New York" })),
      { country: null, region: null, city: null },
    );
  });

  it("normalizes a public IP lookup", () => {
    assert.deepEqual(
      lookupGeoFromIp("8.8.8.8", () => ({ country: "us", region: "ca", city: "Mountain View" })),
      { country: "US", region: "CA", city: "Mountain View" },
    );
  });

  it("resolves a well-known public IP from the local database", () => {
    assert.equal(lookupGeoFromIp("8.8.8.8").country, "US");
  });
});

describe("resolveVisitorGeo", () => {
  it("keeps CDN country and fills city from IP", () => {
    const geo = resolveVisitorGeo(headers({ "cf-ipcountry": "DE", "x-real-ip": "203.0.113.10" }), () => ({
      country: "US",
      region: "BE",
      city: "Berlin",
    }));
    assert.deepEqual(geo, { country: "DE", region: "BE", city: "Berlin" });
  });

  it("falls back to IP lookup when CDN headers are missing", () => {
    const geo = resolveVisitorGeo(headers({ "x-real-ip": "203.0.113.10" }), () => ({
      country: "SK",
      region: "BL",
      city: "Bratislava",
    }));
    assert.deepEqual(geo, { country: "SK", region: "BL", city: "Bratislava" });
  });
});
