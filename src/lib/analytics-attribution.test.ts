import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ctr, formatCtr, hasCampaignParams, mergeAttribution } from "./analytics-attribution";

describe("mergeAttribution", () => {
  it("keeps first-touch and updates last-touch", () => {
    const first = { source: "instagram", medium: "social", campaign: "airpods-september", content: "reel-01", term: null };
    const last = { source: "instagram", medium: "social", campaign: "airpods-september", content: "reel-01", term: null };
    const incoming = { source: "google", medium: "cpc", campaign: "retarget", content: null, term: "headphones" };

    const merged = mergeAttribution(first, last, incoming);

    assert.equal(merged.first.source, "instagram");
    assert.equal(merged.first.campaign, "airpods-september");
    assert.equal(merged.last.source, "google");
    assert.equal(merged.last.campaign, "retarget");
  });

  it("sets first-touch when the session had none", () => {
    const empty = { source: null, medium: null, campaign: null, content: null, term: null };
    const incoming = { source: "instagram", medium: "social", campaign: "launch", content: null, term: null };
    const merged = mergeAttribution(empty, empty, incoming);
    assert.equal(merged.first.source, "instagram");
    assert.equal(merged.last.source, "instagram");
  });

  it("does not overwrite first-touch when later events have no UTM", () => {
    const first = { source: "instagram", medium: "social", campaign: "airpods-september", content: null, term: null };
    const empty = { source: null, medium: null, campaign: null, content: null, term: null };
    const merged = mergeAttribution(first, first, empty);
    assert.equal(merged.first.source, "instagram");
    assert.equal(merged.last.source, "instagram");
  });
});

describe("hasCampaignParams", () => {
  it("detects any UTM field", () => {
    assert.equal(hasCampaignParams({ source: null, medium: null, campaign: "x", content: null, term: null }), true);
    assert.equal(hasCampaignParams({ source: null, medium: null, campaign: null, content: null, term: null }), false);
  });
});

describe("ctr", () => {
  it("returns null when there are no views", () => {
    assert.equal(ctr(10, 0), null);
  });

  it("returns zero when there are views but no clicks", () => {
    assert.equal(ctr(0, 100), 0);
  });

  it("calculates product CTR", () => {
    assert.equal(ctr(3766, 12481)?.toFixed(1), "30.2");
  });
});

describe("formatCtr", () => {
  it("formats null as an em dash", () => {
    assert.equal(formatCtr(null), "—");
  });
});
