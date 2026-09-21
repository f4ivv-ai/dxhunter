/**
 * Tests for the smart WebSDR selection module (websdrSmart.ts).
 * Tests the selection algorithm logic without DB (mocking DB helpers).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module to avoid actual database calls
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Import after mocking
import { findBestSdrsForDx, findSmartCorridorSdrs } from "./websdrSmart";

describe("websdrSmart — findBestSdrsForDx", () => {
  it("returns empty array when no DX position can be resolved", async () => {
    const result = await findBestSdrsForDx("UNKNOWNCALL", 14200, "SSB", undefined, undefined, null, 5);
    expect(result.sdrs).toHaveLength(0);
    expect(result.totalAvailable).toBe(0);
  });

  it("returns SDRs sorted by distance when DX position is known", async () => {
    // Use a known DX position (Germany, ~center)
    const result = await findBestSdrsForDx("DL1ABC", 14200, "SSB", 51.0, 10.0, null, 5);
    expect(result.sdrs.length).toBeGreaterThan(0);
    expect(result.sdrs.length).toBeLessThanOrEqual(5);
    // Verify sorted by distance
    for (let i = 1; i < result.sdrs.length; i++) {
      expect(result.sdrs[i].distanceKm).toBeGreaterThanOrEqual(result.sdrs[i - 1].distanceKm);
    }
  });

  it("resolves DX position from callsign prefix when lat/lon not provided", async () => {
    // JA prefix should resolve to Japan area
    const result = await findBestSdrsForDx("JA1ABC", 7100, "SSB", undefined, undefined, null, 5);
    expect(result.sdrs.length).toBeGreaterThan(0);
    // The closest SDRs should be in Asia/Pacific area
    expect(result.totalAvailable).toBeGreaterThan(0);
  });

  it("respects maxResults parameter", async () => {
    const result = await findBestSdrsForDx("DL1ABC", 14200, "SSB", 51.0, 10.0, null, 3);
    expect(result.sdrs.length).toBeLessThanOrEqual(3);
  });

  it("includes tuneUrl for each SDR result", async () => {
    const result = await findBestSdrsForDx("DL1ABC", 14200, "SSB", 51.0, 10.0, null, 5);
    for (const sdr of result.sdrs) {
      expect(sdr.tuneUrl).toBeDefined();
      expect(sdr.tuneUrl.length).toBeGreaterThan(0);
    }
  });

  it("includes all required fields in results", async () => {
    const result = await findBestSdrsForDx("DL1ABC", 14200, "SSB", 51.0, 10.0, null, 5);
    for (const sdr of result.sdrs) {
      expect(sdr.name).toBeDefined();
      expect(sdr.url).toBeDefined();
      expect(sdr.city).toBeDefined();
      expect(sdr.country).toBeDefined();
      expect(typeof sdr.lat).toBe("number");
      expect(typeof sdr.lon).toBe("number");
      expect(typeof sdr.distanceKm).toBe("number");
      expect(typeof sdr.isFavorite).toBe("boolean");
      expect(sdr.isFavorite).toBe(false); // No DB = no favorites
    }
  });
});

describe("websdrSmart — findSmartCorridorSdrs", () => {
  it("returns corridor result with correct structure", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "SP", "SSB", null);
    expect(result.corridorBearing).toBe(300);
    expect(result.corridorLabel).toBeDefined();
    expect(result.path).toBe("SP");
    expect(Array.isArray(result.local)).toBe(true);
    expect(Array.isArray(result.lointain)).toBe(true);
    expect(Array.isArray(result.iles)).toBe(true);
  });

  it("handles LP path correctly (bearing + 180)", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "LP", "SSB", null);
    // LP: corridor = 300 + 180 = 480 % 360 = 120
    expect(result.corridorBearing).toBe(120);
    expect(result.path).toBe("LP");
  });

  it("classifies local SDRs within 500 km", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "SP", "SSB", null);
    expect(result.local[0]).toMatchObject({
      name: "KiwiSDR F4IVV | Marcilloles (38)",
      isPriority: true,
    });
    for (const sdr of result.local) {
      expect(sdr.distanceKm).toBeLessThanOrEqual(500);
      expect(sdr.category).toBe("local");
    }
  });

  it("classifies lointain SDRs at 6000+ km", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "SP", "SSB", null);
    for (const sdr of result.lointain) {
      expect(sdr.distanceKm).toBeGreaterThanOrEqual(6000);
      expect(sdr.category).toBe("lointain");
    }
  });

  it("includes all required fields in corridor results", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "SP", "SSB", null);
    const allSdrs = [...result.local, ...result.lointain, ...result.iles];
    for (const sdr of allSdrs) {
      expect(sdr.name).toBeDefined();
      expect(sdr.url).toBeDefined();
      expect(sdr.tuneUrl).toBeDefined();
      expect(sdr.city).toBeDefined();
      expect(sdr.country).toBeDefined();
      expect(sdr.flag).toBeDefined();
      expect(sdr.continent).toBeDefined();
      expect(sdr.continentShort).toBeDefined();
      expect(typeof sdr.lat).toBe("number");
      expect(typeof sdr.lon).toBe("number");
      expect(typeof sdr.bearingFromQth).toBe("number");
      expect(typeof sdr.offsetDeg).toBe("number");
      expect(typeof sdr.isFavorite).toBe("boolean");
      expect(sdr.isFavorite).toBe(false); // No DB = no favorites
    }
  });

  it("generates correct cardinal label", async () => {
    const result = await findSmartCorridorSdrs(7185, 0, "SP", "SSB", null);
    expect(result.corridorLabel).toBe("N");
    const result2 = await findSmartCorridorSdrs(7185, 90, "SP", "SSB", null);
    expect(result2.corridorLabel).toBe("E");
    const result3 = await findSmartCorridorSdrs(7185, 180, "SP", "SSB", null);
    expect(result3.corridorLabel).toBe("S");
  });

  it("does not have duplicates across categories", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "SP", "SSB", null);
    const allNames = [
      ...result.local.map(s => s.name),
      ...result.lointain.map(s => s.name),
      ...result.iles.map(s => s.name),
    ];
    const uniqueNames = new Set(allNames);
    expect(uniqueNames.size).toBe(allNames.length);
  });

  it("limits results per category", async () => {
    const result = await findSmartCorridorSdrs(7185, 300, "SP", "SSB", null);
    expect(result.local.length).toBeLessThanOrEqual(8);
    expect(result.lointain.length).toBeLessThanOrEqual(10);
    expect(result.iles.length).toBeLessThanOrEqual(10);
  });
});
