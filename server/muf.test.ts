import { describe, it, expect } from "vitest";
import { parseGiroResponse, median, filterOutliers, computeMFactor } from "./muf";

describe("MUF module", () => {
  describe("parseGiroResponse", () => {
    it("extracts valid readings with CS >= 70", () => {
      const text = `# Comment line
2026-07-06T16:20:02.000Z 100  5.600 //
2026-07-06T16:25:00.000Z  45  5.200 //
2026-07-06T16:30:01.000Z  50  5.600 //
2026-07-06T16:50:02.000Z  90  5.750 //
2026-07-06T16:55:00.000Z  70  5.800 //
2026-07-06T17:00:01.000Z  95  5.750 //`;

      const result = parseGiroResponse(text);
      // CS >= 70: 5.600 (100), 5.750 (90), 5.800 (70), 5.750 (95)
      expect(result.values).toEqual([5.6, 5.75, 5.8, 5.75]);
      expect(result.timestamps).toHaveLength(4);
    });

    it("returns empty for no valid readings", () => {
      const text = `# Only comments
2026-07-06T16:25:00.000Z  30  5.200 //
2026-07-06T16:30:01.000Z  40  5.600 //`;

      const result = parseGiroResponse(text);
      expect(result.values).toEqual([]);
    });

    it("handles empty response", () => {
      const result = parseGiroResponse("");
      expect(result.values).toEqual([]);
    });
  });

  describe("median", () => {
    it("returns null for empty array", () => {
      expect(median([])).toBeNull();
    });

    it("returns single value for array of 1", () => {
      expect(median([5.5])).toBe(5.5);
    });

    it("returns middle value for odd-length array", () => {
      expect(median([5.0, 5.5, 6.0])).toBe(5.5);
    });

    it("returns average of two middle values for even-length array", () => {
      expect(median([5.0, 5.5, 5.8, 6.0])).toBe(5.65);
    });

    it("handles unsorted input", () => {
      expect(median([6.0, 5.0, 5.5])).toBe(5.5);
    });
  });

  describe("filterOutliers", () => {
    it("returns single value unchanged", () => {
      expect(filterOutliers([5.5])).toEqual([5.5]);
    });

    it("filters outlier from 2-value array with >50% spread", () => {
      // 5.65 and 9.7: spread = (9.7-5.65)/5.65 = 71% > 50%
      // Should keep only the lower value (conservative)
      const filtered = filterOutliers([5.65, 9.7]);
      expect(filtered).not.toContain(9.7);
      expect(filtered).toContain(5.65);
    });

    it("keeps both values for 2-value array with <50% spread", () => {
      const filtered = filterOutliers([5.5, 6.0]);
      expect(filtered).toEqual([5.5, 6.0]);
    });

    it("filters outlier from 3-value array with >50% spread", () => {
      // 5.65, 6.0, 9.7: spread = (9.7-5.65)/5.65 = 71% > 50%
      const filtered = filterOutliers([5.65, 6.0, 9.7]);
      expect(filtered).not.toContain(9.7);
    });

    it("removes outliers from larger arrays via IQR", () => {
      const values = [5.6, 5.7, 5.8, 5.75, 5.65, 5.9, 9.7, 5.7];
      const filtered = filterOutliers(values);
      expect(filtered).not.toContain(9.7);
      expect(filtered.length).toBe(7);
    });

    it("keeps all values when no outliers (large array)", () => {
      const values = [5.6, 5.7, 5.8, 5.75, 5.65];
      const filtered = filterOutliers(values);
      expect(filtered).toEqual(values);
    });
  });

  describe("computeMFactor (Shimazaki)", () => {
    it("returns reasonable M factor for typical hmF2 (250 km)", () => {
      const m = computeMFactor(250);
      // M ≈ 1490/(250+176) - 0.176 ≈ 3.50 - 0.176 ≈ 3.32
      expect(m).toBeGreaterThan(3.0);
      expect(m).toBeLessThan(3.5);
    });

    it("returns higher M for lower hmF2 (200 km)", () => {
      const m = computeMFactor(200);
      // M ≈ 1490/(200+176) - 0.176 ≈ 3.96 - 0.176 ≈ 3.79
      expect(m).toBeGreaterThan(3.5);
      expect(m).toBeLessThan(4.0);
    });

    it("returns lower M for higher hmF2 (350 km)", () => {
      const m = computeMFactor(350);
      // M ≈ 1490/(350+176) - 0.176 ≈ 2.83 - 0.176 ≈ 2.66
      expect(m).toBeGreaterThan(2.5);
      expect(m).toBeLessThan(3.0);
    });

    it("clamps to minimum 2.0", () => {
      const m = computeMFactor(1000); // very high hmF2
      expect(m).toBe(2.0);
    });

    it("clamps to maximum 4.0", () => {
      const m = computeMFactor(100); // very low hmF2
      expect(m).toBe(4.0);
    });
  });

  describe("MUF calculation integration", () => {
    it("correct MUF with typical values (foF2=5.7, hmF2=255)", () => {
      const foF2 = 5.7;
      const hmF2 = 255;
      const m = computeMFactor(hmF2);
      const muf = foF2 * m;
      // M ≈ 1490/(255+176) - 0.176 ≈ 3.46 - 0.176 ≈ 3.28
      // MUF ≈ 5.7 × 3.28 ≈ 18.7 MHz
      expect(muf).toBeGreaterThan(17);
      expect(muf).toBeLessThan(20);
    });

    it("Rome 9.7 MHz outlier is filtered correctly", () => {
      // Simulating the Rome data with enough points for IQR
      const romeValues = [5.65, 5.75, 6.0, 9.7, 5.8, 5.9, 5.7];
      const filtered = filterOutliers(romeValues);
      expect(filtered).not.toContain(9.7);
      const med = median(filtered);
      expect(med).not.toBeNull();
      expect(med!).toBeGreaterThan(5.5);
      expect(med!).toBeLessThan(6.5);
    });

    it("MUF with single station fallback (M=2.8)", () => {
      const foF2 = 5.7;
      const mFallback = 2.8;
      const muf = foF2 * mFallback;
      expect(muf).toBeCloseTo(15.96);
    });
  });
});
