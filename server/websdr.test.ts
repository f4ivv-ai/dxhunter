import { describe, it, expect } from "vitest";
import {
  locatorToLatLon,
  callToLocator,
  buildTuneUrl,
  findNearbyWebsdr,
} from "./websdr";

describe("WebSDR module", () => {
  describe("locatorToLatLon", () => {
    it("converts JN25 to approximate lat/lon in France", () => {
      const pos = locatorToLatLon("JN25");
      expect(pos).not.toBeNull();
      expect(pos!.lat).toBeGreaterThan(44);
      expect(pos!.lat).toBeLessThan(47);
      expect(pos!.lon).toBeGreaterThan(0);
      expect(pos!.lon).toBeLessThan(6);
    });

    it("converts PM95 to approximate lat/lon in Japan", () => {
      const pos = locatorToLatLon("PM95");
      expect(pos).not.toBeNull();
      expect(pos!.lat).toBeGreaterThan(34);
      expect(pos!.lat).toBeLessThan(37);
      expect(pos!.lon).toBeGreaterThan(135);
      expect(pos!.lon).toBeLessThan(140);
    });

    it("returns null for empty/short input", () => {
      expect(locatorToLatLon("")).toBeNull();
      expect(locatorToLatLon("JN")).toBeNull();
    });

    it("handles 6-character locator", () => {
      const pos = locatorToLatLon("JN25PG");
      expect(pos).not.toBeNull();
      expect(pos!.lat).toBeGreaterThan(45);
      expect(pos!.lat).toBeLessThan(46);
    });
  });

  describe("callToLocator", () => {
    it("resolves standard prefixes", () => {
      expect(callToLocator("F4IVV")).toBe("JN18");
      expect(callToLocator("DL8ECA")).toBe("JO51");
      expect(callToLocator("JA1ABC")).toBe("PM95");
      expect(callToLocator("W1AW")).toBe("EM79");
    });

    it("resolves special prefixes (EM=Ukraine, HF0=South Shetland, TM=France)", () => {
      expect(callToLocator("EM0WWA")).toBe("KO50");
      expect(callToLocator("HF0PAS")).toBe("GC40"); // HF0 = South Shetland (Polish polar expedition)
      expect(callToLocator("HF7ABC")).toBe("JO91"); // HF (not HF0) = Poland
      expect(callToLocator("TM0HQ")).toBe("JN18");
    });

    it("strips /P and /QRP suffixes", () => {
      expect(callToLocator("DL8ECA/P")).toBe("JO51");
      expect(callToLocator("JA1ABC/QRP")).toBe("PM95");
    });

    it("returns null for unknown prefix", () => {
      expect(callToLocator("ZZZZZ")).toBeNull();
    });
  });

  describe("buildTuneUrl", () => {
    it("generates WebSDR URL with frequency and mode", () => {
      const url = buildTuneUrl("http://example.com:8901", "websdr", 14220, "USB");
      expect(url).toBe("http://example.com:8901/?tune=14220.0usb");
    });

    it("generates KiwiSDR URL with frequency and mode", () => {
      const url = buildTuneUrl("http://kiwi.example.com:8073", "kiwisdr", 7025, "CW");
      expect(url).toBe("http://kiwi.example.com:8073/?f=7025.00/cw&z=10");
    });

    it("generates OpenWebRX URL with frequency in Hz", () => {
      const url = buildTuneUrl("https://openwebrx.example.com", "openwebrx", 3573, "FT8");
      expect(url).toBe("https://openwebrx.example.com/#freq=3573000,mod=usb");
    });

    it("defaults to LSB below 10 MHz when no mode given", () => {
      const url = buildTuneUrl("http://example.com:8901", "websdr", 7025);
      expect(url).toBe("http://example.com:8901/?tune=7025.0lsb");
    });

    it("defaults to USB above 10 MHz when no mode given", () => {
      const url = buildTuneUrl("http://example.com:8901", "websdr", 14220);
      expect(url).toBe("http://example.com:8901/?tune=14220.0usb");
    });

    it("force LSB même si mode=USB est passé quand freq < 10 MHz", () => {
      const url = buildTuneUrl("http://example.com:8901", "websdr", 7120, "USB");
      expect(url).toBe("http://example.com:8901/?tune=7120.0lsb");
    });

    it("force LSB sur 80m même si mode=SSB est passé", () => {
      const url = buildTuneUrl("http://example.com:8901", "websdr", 3750, "SSB");
      expect(url).toBe("http://example.com:8901/?tune=3750.0lsb");
    });

    it("conserve USB sur 20m quand mode=SSB est passé", () => {
      const url = buildTuneUrl("http://example.com:8901", "websdr", 14250, "SSB");
      expect(url).toBe("http://example.com:8901/?tune=14250.0usb");
    });
  });

  describe("findNearbyWebsdr", () => {
    it("finds SDRs near Japan using prefix fallback", () => {
      const results = findNearbyWebsdr("JA1ABC", 7025, "CW");
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      // First result should be relatively close to Japan
      expect(results[0].distanceKm).toBeLessThan(5000);
    });

    it("finds SDRs using direct lat/lon (priority over prefix)", () => {
      // Kyiv, Ukraine coordinates
      const results = findNearbyWebsdr("ZZZZZ", 14220, "USB", undefined, 5, 50.45, 30.52);
      expect(results.length).toBeGreaterThan(0);
      // Should find Ukrainian or nearby SDRs
      expect(results[0].distanceKm).toBeLessThan(2000);
    });

    it("prefers lat/lon over prefix when both available", () => {
      // Use JA prefix but give coordinates in Europe
      const results = findNearbyWebsdr("JA1ABC", 14220, "USB", undefined, 5, 48.85, 2.35);
      expect(results.length).toBeGreaterThan(0);
      // Should find European SDRs (near Paris), not Japanese
      expect(results[0].distanceKm).toBeLessThan(2000);
    });

    it("returns empty array for unknown callsign without coordinates", () => {
      const results = findNearbyWebsdr("ZZZZZ", 14220, "USB");
      expect(results).toEqual([]);
    });

    it("uses locator when provided", () => {
      const results = findNearbyWebsdr("ZZZZZ", 14220, "USB", "JN18");
      expect(results.length).toBeGreaterThan(0);
      // Should find French/European SDRs
      expect(results[0].distanceKm).toBeLessThan(3000);
    });

    it("generates correct tune URLs in results", () => {
      const results = findNearbyWebsdr("DL8ECA", 7025, "CW");
      expect(results.length).toBeGreaterThan(0);
      for (const sdr of results) {
        expect(sdr.tuneUrl).toContain("7025");
        expect(sdr.tuneUrl).toContain("cw");
      }
    });
  });
});
