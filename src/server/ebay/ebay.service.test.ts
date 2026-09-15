import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEbayService } from "./ebay.service";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("EbayService", () => {
  it("searches the Browse API with an application token", async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const service = createEbayService({
      clientId: "id",
      clientSecret: "secret",
      marketplaceId: "EBAY_US",
      environment: "production",
      affiliateCampaignId: "5338",
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, headers: new Headers(init?.headers) });
        if (url.includes("/identity/v1/oauth2/token")) {
          return jsonResponse({ access_token: "token-1", expires_in: 7200 });
        }
        return jsonResponse({
          itemSummaries: [
            {
              legacyItemId: "123456789",
              title: "Sony WH-1000XM5 Wireless Headphones",
              price: { value: "249.99", currency: "USD" },
              condition: "New",
              seller: { username: "ExampleSeller" },
              image: { imageUrl: "https://i.ebayimg.com/example.jpg" },
            },
          ],
        });
      },
    });

    const hits = await service.search("Sony WH-1000XM5");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.itemId, "123456789");
    assert.equal(hits[0]?.price, 249.99);
    assert.ok(calls.some((call) => call.url.includes("/item_summary/search?q=Sony")));
  });

  it("imports a listing and generates an affiliate URL", async () => {
    const service = createEbayService({
      clientId: "id",
      clientSecret: "secret",
      marketplaceId: "EBAY_US",
      environment: "production",
      affiliateCampaignId: "5338123456",
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (url.includes("/oauth2/token")) {
          return jsonResponse({ access_token: "token-1", expires_in: 7200 });
        }
        const headers = new Headers(init?.headers);
        assert.equal(
          headers.get("X-EBAY-C-ENDUSERCTX"),
          "affiliateCampaignId=5338123456,affiliateReferenceId=radarcut-ebay-123456789",
        );
        return jsonResponse({
          itemId: "v1|123456789|0",
          legacyItemId: "123456789",
          title: "Sony WH-1000XM5 Wireless Headphones",
          shortDescription: "Noise cancelling headphones",
          description: "Wireless headphones",
          price: { value: "249.99", currency: "USD" },
          image: { imageUrl: "https://i.ebayimg.com/example.jpg" },
          itemWebUrl: "https://www.ebay.com/itm/123456789",
          itemAffiliateWebUrl: "https://www.ebay.com/itm/123456789?campid=5338123456&customid=radarcut-ebay-123456789",
          condition: "New",
          brand: "Sony",
          seller: { username: "ExampleSeller" },
          estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }],
        });
      },
    });

    const listing = await service.getListingByInput("https://www.ebay.com/itm/123456789");
    assert.equal(listing.itemId, "123456789");
    assert.equal(listing.price, 249.99);
    assert.notEqual(listing.affiliateUrl, listing.productUrl);
    assert.match(listing.affiliateUrl, /campid=5338123456/);
    assert.equal(listing.affiliateReferenceId, "radarcut-ebay-123456789");
  });

  it("maps 404 to a listing-not-found error", async () => {
    const service = createEbayService({
      clientId: "id",
      clientSecret: "secret",
      marketplaceId: "EBAY_US",
      environment: "production",
      affiliateCampaignId: "5338",
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/oauth2/token")) {
          return jsonResponse({ access_token: "token-1", expires_in: 7200 });
        }
        return jsonResponse({ errors: [{ message: "not found" }] }, 404);
      },
    });

    await assert.rejects(() => service.getListingByLegacyId("999999999"), /not found/i);
  });

  it("explains invalid_client as rejected credentials, not missing env vars", async () => {
    const service = createEbayService({
      clientId: "id",
      clientSecret: "secret",
      marketplaceId: "EBAY_US",
      environment: "production",
      fetchImpl: async () =>
        jsonResponse({ error: "invalid_client", error_description: "client authentication failed" }, 401),
    });

    await assert.rejects(
      () => service.search("Sony WH-1000XM5"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /rejected the production App ID \/ Cert ID pair/i);
        assert.match(error.message, /are set/i);
        return true;
      },
    );
  });

  it("rejects live ebay.com URLs when running against sandbox", async () => {
    const service = createEbayService({
      clientId: "id",
      clientSecret: "secret",
      marketplaceId: "EBAY_US",
      environment: "sandbox",
      fetchImpl: async () => {
        throw new Error("sandbox must not call eBay for a live listing URL");
      },
    });

    await assert.rejects(
      () => service.getListingByInput("https://www.ebay.com/itm/123456789"),
      /sandbox/i,
    );
  });
});
