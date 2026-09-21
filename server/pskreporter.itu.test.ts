import { describe, it, expect, beforeEach } from "vitest";
import {
  locatorToItuZone,
  gridToLatLon,
  getPropagationSummary,
  _testInjectSpot,
  _testReset,
} from "./pskreporter";

describe("locatorToItuZone", () => {
  it("returns zone 27 for Paris (JN18)", () => {
    expect(locatorToItuZone("JN18")).toBe(27);
  });

  it("returns zone 27 for London (IO91)", () => {
    expect(locatorToItuZone("IO91")).toBe(27);
  });

  it("returns zone 27 for Brussels (JO20)", () => {
    expect(locatorToItuZone("JO20")).toBe(27);
  });

  it("returns zone 28 for Rome (JN61)", () => {
    expect(locatorToItuZone("JN61")).toBe(28);
  });

  it("returns zone 28 for Madrid (IN80)", () => {
    expect(locatorToItuZone("IN80")).toBe(28);
  });

  it("returns zone 18 for Stockholm (JO89)", () => {
    expect(locatorToItuZone("JO89")).toBe(18);
  });

  it("returns zone 8 for New York (FN30)", () => {
    expect(locatorToItuZone("FN30")).toBe(8);
  });

  it("returns zone 45 for Tokyo (PM95)", () => {
    expect(locatorToItuZone("PM95")).toBe(45);
  });

  it("returns zone 12 for Brazil (GG87)", () => {
    expect(locatorToItuZone("GG87")).toBe(12);
  });

  it("returns 0 for empty/short grid", () => {
    expect(locatorToItuZone("")).toBe(0);
    expect(locatorToItuZone("JN")).toBe(0);
  });
});

describe("gridToLatLon", () => {
  it("returns approximate coords for JN18 (Paris)", () => {
    const { lat, lon } = gridToLatLon("JN18");
    expect(lat).toBeGreaterThan(47);
    expect(lat).toBeLessThan(50);
    expect(lon).toBeGreaterThan(0);
    expect(lon).toBeLessThan(5);
  });
});

describe("getPropagationSummary with zone filter", () => {
  beforeEach(() => {
    _testReset();
  });

  it("returns all spots when no zone filter", () => {
    _testInjectSpot({ band: "20m", continent: "NA", snr: 5, rxItuZone: 27 });
    _testInjectSpot({ band: "20m", continent: "NA", snr: 3, rxItuZone: 28 });
    _testInjectSpot({ band: "40m", continent: "EU", snr: 10, rxItuZone: 18 });

    const summary = getPropagationSummary();
    expect(summary.bands["20m"].total).toBe(2);
    expect(summary.bands["40m"].total).toBe(1);
    expect(summary.totalSpotsInWindow).toBe(3);
    expect(summary.filteredByZone).toBeUndefined();
  });

  it("filters by zone 27 (France)", () => {
    _testInjectSpot({ band: "20m", continent: "NA", snr: 5, rxItuZone: 27 });
    _testInjectSpot({ band: "20m", continent: "NA", snr: 3, rxItuZone: 28 });
    _testInjectSpot({ band: "40m", continent: "EU", snr: 10, rxItuZone: 27 });

    const summary = getPropagationSummary(27);
    expect(summary.bands["20m"].total).toBe(1); // only zone 27
    expect(summary.bands["40m"].total).toBe(1);
    expect(summary.totalSpotsInWindow).toBe(3); // total before filter
    expect(summary.filteredByZone).toBe(27);
  });

  it("returns empty when zone has no spots", () => {
    _testInjectSpot({ band: "20m", continent: "NA", snr: 5, rxItuZone: 27 });

    const summary = getPropagationSummary(45); // Japan zone
    expect(summary.bands["20m"].total).toBe(0);
    expect(summary.totalSpotsInWindow).toBe(1);
    expect(summary.filteredByZone).toBe(45);
  });
});
