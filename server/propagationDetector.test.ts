import { describe, it, expect, beforeEach } from "vitest";
import {
  ingestSpot,
  getOpenings,
  getVhfActivity,
  _testReset,
  detectTypeFromComment,
  detectTypeFromContext,
  freqToBand,
  extractSnr,
} from "./propagationDetector";

beforeEach(() => {
  _testReset();
});

describe("freqToBand", () => {
  it("maps 50125 kHz to 6m", () => {
    expect(freqToBand(50125)).toBe("6m");
  });
  it("maps 70200 kHz to 4m", () => {
    expect(freqToBand(70200)).toBe("4m");
  });
  it("maps 144300 kHz to 2m", () => {
    expect(freqToBand(144300)).toBe("2m");
  });
  it("maps 432100 kHz to 70cm", () => {
    expect(freqToBand(432100)).toBe("70cm");
  });
  it("maps 28500 kHz to 10m", () => {
    expect(freqToBand(28500)).toBe("10m");
  });
  it("maps 14200 kHz to 20m (now covers all HF bands)", () => {
    expect(freqToBand(14200)).toBe("20m");
  });
  it("returns null for out-of-band frequency", () => {
    expect(freqToBand(5000)).toBeNull();
  });
});

describe("detectTypeFromComment", () => {
  it("detects Sporadic E from 'Es open'", () => {
    expect(detectTypeFromComment("Es open to EU")).toBe("Es");
  });
  it("detects TEP from 'TEP'", () => {
    expect(detectTypeFromComment("TEP opening to SA")).toBe("TEP");
  });
  it("detects Tropo from 'tropo'", () => {
    expect(detectTypeFromComment("tropo duct to G")).toBe("Tropo");
  });
  it("detects MS from 'meteor scatter'", () => {
    expect(detectTypeFromComment("meteor scatter burst")).toBe("MS");
  });
  it("detects Aurora from 'aurora'", () => {
    expect(detectTypeFromComment("aurora signal")).toBe("Aurora");
  });
  it("detects F2 from 'F2 layer'", () => {
    expect(detectTypeFromComment("F2 layer opening")).toBe("F2");
  });
  it("detects Es from '50 mhz' hint", () => {
    expect(detectTypeFromComment("50 mhz band open")).toBe("Es");
  });
  it("returns null for normal comment", () => {
    expect(detectTypeFromComment("CQ CQ")).toBeNull();
  });
});

describe("extractSnr", () => {
  it("extracts -12 dB", () => {
    expect(extractSnr("-12 dB")).toBe(-12);
  });
  it("extracts +5dB", () => {
    expect(extractSnr("+5dB")).toBe(5);
  });
  it("returns null for no SNR", () => {
    expect(extractSnr("CQ CQ")).toBeNull();
  });
});

describe("detectTypeFromContext", () => {
  it("6m + 1200 km = Es", () => {
    expect(detectTypeFromContext("6m", 1200, 50125)).toBe("Es");
  });
  it("2m + 500 km = Tropo", () => {
    expect(detectTypeFromContext("2m", 500, 144300)).toBe("Tropo");
  });
  it("2m + 2000 km = Es (rare double-hop)", () => {
    expect(detectTypeFromContext("2m", 2000, 144300)).toBe("Es");
  });
  it("70cm + 300 km = Tropo", () => {
    expect(detectTypeFromContext("70cm", 300, 432100)).toBe("Tropo");
  });
  it("10m + 4000 km = Es", () => {
    expect(detectTypeFromContext("10m", 4000, 28500)).toBe("Es");
  });
});

describe("ingestSpot + getOpenings", () => {
  it("no openings when no spots ingested", () => {
    const result = getOpenings();
    expect(result.openings).toHaveLength(0);
  });

  it("detects Es opening from keyword in comment on 6m", () => {
    const now = Math.floor(Date.now() / 1000);
    // Ingest 3 spots on 6m with Es keyword
    for (let i = 0; i < 3; i++) {
      ingestSpot({
        id: `spot-${i}`,
        dx_call: `EA${i}ABC`,
        de_call: "F5XYZ",
        freq: 50125000, // 50.125 MHz in Hz
        band: "6m",
        comment: "Es open to EA",
        dx_country: "Spain",
        dx_continent: "EU",
        de_continent: "EU",
        dx_latitude: 40.0,
        dx_longitude: -3.5,
        de_latitude: 48.8,
        de_longitude: 2.3,
        received_time: now - i * 60,
      });
    }

    const result = getOpenings();
    expect(result.openings.length).toBeGreaterThanOrEqual(1);
    const esOpening = result.openings.find(o => o.type === "Es");
    expect(esOpening).toBeDefined();
    expect(esOpening!.band).toBe("6m");
    expect(esOpening!.spotCount).toBe(3);
    expect(esOpening!.confidence).toBe("medium"); // 3 spots + keyword (high requires 5+)
    expect(esOpening!.stations).toContain("EA0ABC");
  });

  it("detects propagation from distance on 6m (no keyword)", () => {
    const now = Math.floor(Date.now() / 1000);
    // 2 spots on 6m with distance > 500 km but no keyword
    for (let i = 0; i < 2; i++) {
      ingestSpot({
        id: `spot-dist-${i}`,
        dx_call: `I${i}XYZ`,
        de_call: "F5ABC",
        freq: 50100000,
        band: "6m",
        comment: "CQ CQ",
        dx_country: "Italy",
        dx_continent: "EU",
        de_continent: "EU",
        dx_latitude: 42.0, // Rome
        dx_longitude: 12.5,
        de_latitude: 48.8, // Paris
        de_longitude: 2.3,
        received_time: now - i * 30,
      });
    }

    const result = getOpenings();
    const esOpening = result.openings.find(o => o.type === "Es" && o.band === "6m");
    expect(esOpening).toBeDefined();
    expect(esOpening!.spotCount).toBe(2);
    expect(esOpening!.maxDistanceKm).toBeGreaterThan(500);
  });

  it("getVhfActivity returns VHF spots even without confirmed opening", () => {
    const now = Math.floor(Date.now() / 1000);
    ingestSpot({
      id: "vhf-1",
      dx_call: "DL1ABC",
      de_call: "F5XYZ",
      freq: 144300000,
      band: "2m",
      comment: "CQ",
      dx_country: "Germany",
      dx_continent: "EU",
      de_continent: "EU",
      dx_latitude: 51.0,
      dx_longitude: 10.0,
      de_latitude: 48.8,
      de_longitude: 2.3,
      received_time: now,
    });

    const activity = getVhfActivity();
    const band2m = activity.find(a => a.band === "2m");
    expect(band2m).toBeDefined();
    expect(band2m!.count).toBe(1);
    expect(band2m!.stations).toContain("DL1ABC");
  });
});
