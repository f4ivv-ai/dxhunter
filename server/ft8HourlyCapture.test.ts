import { describe, it, expect } from "vitest";
import {
  bearing,
  locatorToContinent,
  CONTINENT_CENTERS,
  CONTEST_BANDS,
  CONTINENTS,
  SNR_THRESHOLD_SSB,
} from "./ft8HourlyCapture";

describe("ft8HourlyCapture", () => {
  describe("bearing()", () => {
    it("calcule l'azimut JN25 → NA (environ 300-320°)", () => {
      const az = bearing(45.27, 5.29, 40.0, -100.0);
      expect(az).toBeGreaterThan(290);
      expect(az).toBeLessThan(330);
    });

    it("calcule l'azimut JN25 → AF (environ 160-190°)", () => {
      const az = bearing(45.27, 5.29, 5.0, 25.0);
      expect(az).toBeGreaterThan(140);
      expect(az).toBeLessThan(200);
    });

    it("calcule l'azimut JN25 → AS (environ 50-80°)", () => {
      const az = bearing(45.27, 5.29, 35.0, 90.0);
      expect(az).toBeGreaterThan(40);
      expect(az).toBeLessThan(90);
    });

    it("calcule l'azimut JN25 → SA (environ 220-250°)", () => {
      const az = bearing(45.27, 5.29, -15.0, -55.0);
      expect(az).toBeGreaterThan(210);
      expect(az).toBeLessThan(260);
    });

    it("calcule l'azimut JN25 → OC (environ 60-100°)", () => {
      const az = bearing(45.27, 5.29, -25.0, 135.0);
      expect(az).toBeGreaterThan(55);
      expect(az).toBeLessThan(110);
    });
  });

  describe("locatorToContinent()", () => {
    it("JN25 → EU (France)", () => {
      expect(locatorToContinent("JN25")).toBe("EU");
    });

    it("FN31 → NA (New York)", () => {
      expect(locatorToContinent("FN31")).toBe("NA");
    });

    it("GG77 → SA (Brésil)", () => {
      expect(locatorToContinent("GG77")).toBe("SA");
    });

    it("KI07 → AF (Afrique du Sud)", () => {
      expect(locatorToContinent("KI07")).toBe("AF");
    });

    it("PM95 → AS (Japon)", () => {
      expect(locatorToContinent("PM95")).toBe("AS");
    });

    it("QF56 → OC (Australie)", () => {
      expect(locatorToContinent("QF56")).toBe("OC");
    });

    it("retourne ?? pour un locator vide", () => {
      expect(locatorToContinent("")).toBe("??");
    });
  });

  describe("constantes", () => {
    it("SNR_THRESHOLD_SSB est -8 dB", () => {
      expect(SNR_THRESHOLD_SSB).toBe(-8);
    });

    it("6 bandes contest définies", () => {
      expect(CONTEST_BANDS).toHaveLength(6);
      expect(CONTEST_BANDS).toContain("20m");
      expect(CONTEST_BANDS).toContain("40m");
    });

    it("6 continents définis", () => {
      expect(CONTINENTS).toHaveLength(6);
      expect(CONTINENTS).toContain("EU");
      expect(CONTINENTS).toContain("NA");
    });

    it("centres de continents définis avec lat/lon", () => {
      expect(CONTINENT_CENTERS.NA.lat).toBeCloseTo(40.0, 0);
      expect(CONTINENT_CENTERS.NA.lon).toBeCloseTo(-100.0, 0);
      expect(CONTINENT_CENTERS.EU.lat).toBeCloseTo(50.0, 0);
    });
  });
});
