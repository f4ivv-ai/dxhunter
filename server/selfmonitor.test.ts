/**
 * Tests Self-Monitor — Corridor de propagation et classification des SDR.
 * 3 catégories : local (0–500 km), lointain (6000+ km ±30°), îles/côtes (±30°).
 */
import { describe, it, expect } from "vitest";
import { findCorridorSdrs } from "./selfmonitor";

describe("selfmonitor — findCorridorSdrs", () => {
  // ─── Structure ──────────────────────────────────────────────────────────
  it("retourne un résultat structuré avec les 3 catégories", () => {
    const result = findCorridorSdrs(7185, 300, "SP", "SSB");
    expect(result).toHaveProperty("corridorBearing");
    expect(result).toHaveProperty("corridorLabel");
    expect(result).toHaveProperty("path", "SP");
    expect(result).toHaveProperty("local");
    expect(result).toHaveProperty("lointain");
    expect(result).toHaveProperty("iles");
    expect(Array.isArray(result.local)).toBe(true);
    expect(Array.isArray(result.lointain)).toBe(true);
    expect(Array.isArray(result.iles)).toBe(true);
  });

  // ─── SP / LP ────────────────────────────────────────────────────────────
  it("SP : le corridor bearing est l'azimut donné", () => {
    const result = findCorridorSdrs(14200, 300, "SP");
    expect(result.corridorBearing).toBe(300);
    expect(result.path).toBe("SP");
  });

  it("LP : le corridor bearing est l'azimut + 180°", () => {
    const result = findCorridorSdrs(14200, 300, "LP");
    expect(result.corridorBearing).toBe(120);
    expect(result.path).toBe("LP");
  });

  it("LP avec azimut > 180 : wrap correct", () => {
    const result = findCorridorSdrs(7100, 200, "LP");
    expect(result.corridorBearing).toBe(20);
  });

  // ─── LOCAL (0–500 km) ───────────────────────────────────────────────────
  it("local : SDR dans un rayon de 500 km, toutes directions", () => {
    const result = findCorridorSdrs(7185, 300, "SP", "SSB");
    for (const sdr of result.local) {
      expect(sdr.distanceKm).toBeLessThanOrEqual(500);
      expect(sdr.category).toBe("local");
    }
  });

  it("local : triés par distance croissante", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    for (let i = 1; i < result.local.length; i++) {
      expect(result.local[i].distanceKm).toBeGreaterThanOrEqual(result.local[i - 1].distanceKm);
    }
  });

  it("local : inclut des pays proches de JN25PG", () => {
    const result = findCorridorSdrs(7185, 300, "SP", "SSB");
    if (result.local.length > 0) {
      const countries = result.local.map(s => s.country);
      const nearbyCountries = ["FR", "CH", "IT", "DE", "AT", "NL", "BE", "LU", "ES"];
      const hasNearby = countries.some(c => nearbyCountries.includes(c));
      expect(hasNearby).toBe(true);
    }
  });

  // ─── LOINTAIN (6000+ km, ±30°) ─────────────────────────────────────────
  it("lointain : SDR à 6000+ km dans ±30° du corridor", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    for (const sdr of result.lointain) {
      expect(sdr.distanceKm).toBeGreaterThanOrEqual(6000);
      expect(Math.abs(sdr.offsetDeg)).toBeLessThanOrEqual(30);
      expect(sdr.category).toBe("lointain");
    }
  });

  it("lointain : azimut 300° SP trouve des SDR US", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    const usInLointain = result.lointain.filter(s => s.country === "US");
    const usInIles = result.iles.filter(s => s.country === "US");
    expect(usInLointain.length + usInIles.length).toBeGreaterThan(0);
  });

  it("lointain : triés par distance croissante", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    for (let i = 1; i < result.lointain.length; i++) {
      expect(result.lointain[i].distanceKm).toBeGreaterThanOrEqual(result.lointain[i - 1].distanceKm);
    }
  });

  // ─── ÎLES/CÔTES (±30°) ─────────────────────────────────────────────────
  it("iles : SDR côtiers/insulaires dans ±30° du corridor", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    for (const sdr of result.iles) {
      expect(Math.abs(sdr.offsetDeg)).toBeLessThanOrEqual(30);
      expect(sdr.category).toBe("iles");
    }
  });

  it("iles : triés par distance croissante", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    for (let i = 1; i < result.iles.length; i++) {
      expect(result.iles[i].distanceKm).toBeGreaterThanOrEqual(result.iles[i - 1].distanceKm);
    }
  });

  // ─── Pas de doublon entre catégories ────────────────────────────────────
  it("aucun SDR dans plusieurs catégories", () => {
    const result = findCorridorSdrs(14200, 300, "SP", "SSB");
    const names = [
      ...result.local.map(s => s.name),
      ...result.lointain.map(s => s.name),
      ...result.iles.map(s => s.name),
    ];
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  // ─── Champs requis ──────────────────────────────────────────────────────
  it("chaque SDR a les champs requis (flag, continent, tuneUrl)", () => {
    const result = findCorridorSdrs(14195, 300, "SP", "SSB");
    const allSdrs = [...result.local, ...result.lointain, ...result.iles];
    for (const sdr of allSdrs) {
      expect(sdr.flag).toBeTruthy();
      expect(sdr.continent).toBeTruthy();
      expect(sdr.continentShort).toBeTruthy();
      expect(sdr.tuneUrl).toBeTruthy();
      expect(typeof sdr.distanceKm).toBe("number");
      expect(typeof sdr.bearingFromQth).toBe("number");
    }
  });

  it("les URLs de tune contiennent la fréquence", () => {
    const result = findCorridorSdrs(14195, 300, "SP", "SSB");
    const allSdrs = [...result.local, ...result.lointain, ...result.iles];
    for (const sdr of allSdrs.slice(0, 5)) {
      expect(sdr.tuneUrl).toMatch(/14195/);
    }
  });

  // ─── Label cardinal ─────────────────────────────────────────────────────
  it("le label cardinal est cohérent avec le bearing", () => {
    const result = findCorridorSdrs(7185, 300, "SP");
    expect(["ONO", "NO", "O"]).toContain(result.corridorLabel);
  });

  // ─── Directions variées ─────────────────────────────────────────────────
  it("azimut 35° (vers JA) : SDR asiatiques en lointain", () => {
    const result = findCorridorSdrs(21300, 35, "SP", "SSB");
    const combined = [...result.lointain, ...result.iles].map(s => s.continentShort);
    const hasAsian = combined.some(c => c === "AS");
    expect(hasAsian).toBe(true);
  });

  it("LP trouve des SDR différents de SP", () => {
    const sp = findCorridorSdrs(14200, 300, "SP", "SSB");
    const lp = findCorridorSdrs(14200, 300, "LP", "SSB");
    const spNames = new Set(sp.lointain.map(s => s.name));
    const lpNames = new Set(lp.lointain.map(s => s.name));
    const overlap = [...spNames].filter(n => lpNames.has(n));
    expect(overlap.length).toBeLessThan(Math.max(spNames.size, lpNames.size));
  });
});
