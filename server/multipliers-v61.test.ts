/**
 * Tests V6.1 — Export ADIF et logique multiplicateurs travaillés.
 */
import { describe, it, expect } from "vitest";
import {
  extractWpxMultipliers,
  extractCqWwMultipliers,
  SpotLike,
} from "@shared/contestMultipliers";

// Helper : spot minimal
function mkSpot(overrides: Partial<SpotLike> = {}): SpotLike {
  return {
    dx_call: "W1AW",
    de_call: "F6ABC",
    freq: 14200000,
    dx_country: "United States",
    dx_dxcc_id: 291,
    dx_cq_zone: 5,
    dx_latitude: 41.7,
    dx_longitude: -72.7,
    dx_continent: "NA",
    band: "20m",
    mode: "SSB",
    mode_type: "PHONE",
    comment: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ADIF generation logic (inline test since it's a pure function in the component)
// ---------------------------------------------------------------------------
function generateAdifContent(
  mults: { label: string; band: string | null; calls: string[] }[],
  spotData: { dx_call: string; freq: number; mode: string | null; band: string | null; dx_country: string | null }[],
  contestName: string
): string {
  const lines: string[] = [];
  lines.push("ADIF Export from DX Hunter");
  lines.push(`Contest: ${contestName}`);
  lines.push("<EOH>");
  lines.push("");

  for (const m of mults) {
    for (const call of m.calls) {
      const spot = spotData.find(
        (s) => s.dx_call === call && (!m.band || s.band === m.band)
      );
      if (!spot) continue;

      const freqMhz = (spot.freq / 1000000).toFixed(6);
      const mode = spot.mode || "SSB";
      const band = spot.band || "";

      let record = "";
      record += `<CALL:${call.length}>${call}`;
      record += `<FREQ:${freqMhz.length}>${freqMhz}`;
      record += `<MODE:${mode.length}>${mode}`;
      record += `<BAND:${band.length}>${band}`;
      if (spot.dx_country) {
        record += `<COUNTRY:${spot.dx_country.length}>${spot.dx_country}`;
      }
      record += `<COMMENT:${m.label.length}>${m.label}`;
      record += "<EOR>";
      lines.push(record);
    }
  }

  return lines.join("\n");
}

describe("ADIF export", () => {
  it("generates valid ADIF header", () => {
    const adif = generateAdifContent([], [], "CQ WPX");
    expect(adif).toContain("ADIF Export from DX Hunter");
    expect(adif).toContain("Contest: CQ WPX");
    expect(adif).toContain("<EOH>");
  });

  it("generates ADIF records with correct field format", () => {
    const mults = [{ label: "W1", band: null as string | null, calls: ["W1AW"] }];
    const spots = [
      { dx_call: "W1AW", freq: 14200000, mode: "SSB", band: "20m", dx_country: "United States" },
    ];
    const adif = generateAdifContent(mults, spots, "CQ WPX");

    expect(adif).toContain("<CALL:4>W1AW");
    expect(adif).toContain("<FREQ:9>14.200000");
    expect(adif).toContain("<MODE:3>SSB");
    expect(adif).toContain("<BAND:3>20m");
    expect(adif).toContain("<COUNTRY:13>United States");
    expect(adif).toContain("<COMMENT:2>W1");
    expect(adif).toContain("<EOR>");
  });

  it("handles multiple mults and stations", () => {
    const mults = [
      { label: "W1", band: null as string | null, calls: ["W1AW", "W1XX"] },
      { label: "DL3", band: null as string | null, calls: ["DL3ABC"] },
    ];
    const spots = [
      { dx_call: "W1AW", freq: 14200000, mode: "SSB", band: "20m", dx_country: "United States" },
      { dx_call: "W1XX", freq: 7150000, mode: "LSB", band: "40m", dx_country: "United States" },
      { dx_call: "DL3ABC", freq: 21300000, mode: "SSB", band: "15m", dx_country: "Germany" },
    ];
    const adif = generateAdifContent(mults, spots, "CQ WPX");

    const records = adif.split("<EOR>").filter((r) => r.includes("<CALL"));
    expect(records.length).toBe(3);
  });

  it("skips stations not found in spots", () => {
    const mults = [{ label: "XX0", band: null as string | null, calls: ["XX0GHOST"] }];
    const spots: typeof mults extends any[] ? { dx_call: string; freq: number; mode: string | null; band: string | null; dx_country: string | null }[] : never = [];
    const adif = generateAdifContent(mults, spots, "CQ WPX");

    expect(adif).not.toContain("<CALL");
    expect(adif).not.toContain("<EOR>");
  });

  it("defaults mode to SSB when null", () => {
    const mults = [{ label: "W1", band: null as string | null, calls: ["W1AW"] }];
    const spots = [
      { dx_call: "W1AW", freq: 14200000, mode: null, band: "20m", dx_country: null },
    ];
    const adif = generateAdifContent(mults, spots, "CQ WPX");

    expect(adif).toContain("<MODE:3>SSB");
  });
});

// ---------------------------------------------------------------------------
// Worked mults logic (localStorage simulation)
// ---------------------------------------------------------------------------
describe("Worked multipliers logic", () => {
  it("can track worked mults per contest", () => {
    const worked: Record<string, Set<string>> = {};
    worked["CQ_WPX"] = new Set(["W1", "DL3"]);
    worked["CQ_WW"] = new Set(["zone_5_20m"]);

    expect(worked["CQ_WPX"]!.has("W1")).toBe(true);
    expect(worked["CQ_WPX"]!.has("DL3")).toBe(true);
    expect(worked["CQ_WPX"]!.has("K2")).toBe(false);
    expect(worked["CQ_WW"]!.has("zone_5_20m")).toBe(true);
  });

  it("toggle adds and removes mults", () => {
    const set = new Set<string>();

    // Add
    set.add("W1");
    expect(set.has("W1")).toBe(true);

    // Remove
    set.delete("W1");
    expect(set.has("W1")).toBe(false);
  });

  it("serializes to JSON and back", () => {
    const original: Record<string, Set<string>> = {
      CQ_WPX: new Set(["W1", "DL3", "JA1"]),
      CQ_WW: new Set(["zone_5_20m", "country_291_20m"]),
    };

    // Serialize
    const obj: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(original)) {
      obj[k] = Array.from(v);
    }
    const json = JSON.stringify(obj);

    // Deserialize
    const parsed = JSON.parse(json) as Record<string, string[]>;
    const restored: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      restored[k] = new Set(v);
    }

    expect(restored["CQ_WPX"]!.size).toBe(3);
    expect(restored["CQ_WPX"]!.has("JA1")).toBe(true);
    expect(restored["CQ_WW"]!.size).toBe(2);
  });

  it("filter missing only works correctly", () => {
    const allMults = [
      { id: "W1", label: "W1" },
      { id: "DL3", label: "DL3" },
      { id: "JA1", label: "JA1" },
      { id: "VK2", label: "VK2" },
    ];
    const worked = new Set(["W1", "JA1"]);

    const missing = allMults.filter((m) => !worked.has(m.id));
    expect(missing.length).toBe(2);
    expect(missing.map((m) => m.id)).toEqual(["DL3", "VK2"]);
  });

  it("progress calculation is correct", () => {
    const total = 50;
    const workedCount = 23;
    const pct = Math.round((workedCount / total) * 100);
    expect(pct).toBe(46);

    const missing = total - workedCount;
    expect(missing).toBe(27);
  });
});

// ---------------------------------------------------------------------------
// New mult detection logic
// ---------------------------------------------------------------------------
describe("New multiplier detection", () => {
  it("detects new mults compared to previous set", () => {
    const prev = new Set(["W1", "DL3", "JA1"]);
    const current = [
      { id: "W1" },
      { id: "DL3" },
      { id: "JA1" },
      { id: "VK2" },
      { id: "ZS6" },
    ];

    const newMults = current.filter((m) => !prev.has(m.id));
    expect(newMults.length).toBe(2);
    expect(newMults.map((m) => m.id)).toEqual(["VK2", "ZS6"]);
  });

  it("returns empty when no new mults", () => {
    const prev = new Set(["W1", "DL3"]);
    const current = [{ id: "W1" }, { id: "DL3" }];

    const newMults = current.filter((m) => !prev.has(m.id));
    expect(newMults.length).toBe(0);
  });

  it("handles first load (empty previous)", () => {
    const prev = new Set<string>();
    const current = [{ id: "W1" }, { id: "DL3" }];

    // On first load, all are "new" but we skip alerting
    const newMults = current.filter((m) => !prev.has(m.id));
    expect(newMults.length).toBe(2);
  });
});
