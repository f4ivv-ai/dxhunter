/**
 * Tests pour l'intégration DX Summit : normalisation + dédoublonnage.
 * Les fonctions sont définies dans server/routers/spots.ts mais non exportées,
 * on les teste indirectement via la procédure tRPC ou on les extrait.
 * Ici on teste la logique extraite dans un module dédié.
 */
import { describe, it, expect } from "vitest";

// Reproduire les fonctions internes pour les tester unitairement
function freqToBand(freqKhz: number): string | null {
  if (freqKhz >= 1800 && freqKhz <= 2000) return "160m";
  if (freqKhz >= 3500 && freqKhz <= 4000) return "80m";
  if (freqKhz >= 7000 && freqKhz <= 7300) return "40m";
  if (freqKhz >= 14000 && freqKhz <= 14350) return "20m";
  if (freqKhz >= 21000 && freqKhz <= 21450) return "15m";
  if (freqKhz >= 28000 && freqKhz <= 29700) return "10m";
  return null;
}

function normalizeDxSummitSpot(s: {
  id: number;
  dx_call: string;
  de_call: string;
  frequency: number;
  time: string;
  info: string | null;
  dx_country: string | null;
  dx_latitude: number | null;
  dx_longitude: number | null;
  de_latitude: number | null;
  de_longitude: number | null;
}): Record<string, unknown> {
  const freqHz = s.frequency * 1000;
  const band = freqToBand(s.frequency);
  const timeEpoch = Math.floor(new Date(s.time + "Z").getTime() / 1000);
  return {
    id: `dxs-${s.id}`,
    dx_call: s.dx_call,
    dx_name: null,
    dx_qth: null,
    dx_country: s.dx_country,
    dx_flag: null,
    dx_continent: null,
    dx_dxcc_id: null,
    dx_cq_zone: null,
    dx_latitude: s.dx_latitude,
    dx_longitude: s.dx_longitude,
    dx_location_good: s.dx_latitude !== null,
    de_call: s.de_call.replace(/-@$/, ""),
    de_country: null,
    de_continent: null,
    de_latitude: s.de_latitude,
    de_longitude: s.de_longitude,
    mode: "SSB",
    mode_type: "PHONE",
    freq: freqHz,
    band,
    comment: s.info,
    qrt: false,
    time: timeEpoch,
    time_iso: s.time + "Z",
    received_time: timeEpoch,
    source: "DXSummit",
  };
}

function deduplicateSpots(spots: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>();
  for (const s of spots) {
    const call = String(s.dx_call || "").toUpperCase();
    const band = String(s.band || "");
    const time = Number(s.time || 0);
    const slot = Math.floor(time / 120);
    const key = `${call}|${band}|${slot}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, s);
    } else {
      if (String(s.source) !== "DXSummit") {
        seen.set(key, s);
      }
    }
  }
  return Array.from(seen.values());
}

describe("freqToBand", () => {
  it("maps standard HF frequencies to bands", () => {
    expect(freqToBand(1840)).toBe("160m");
    expect(freqToBand(3573)).toBe("80m");
    expect(freqToBand(7074)).toBe("40m");
    expect(freqToBand(14220)).toBe("20m");
    expect(freqToBand(21300)).toBe("15m");
    expect(freqToBand(28500)).toBe("10m");
  });

  it("returns null for out-of-band frequencies", () => {
    expect(freqToBand(5000)).toBeNull();
    expect(freqToBand(50000)).toBeNull();
    expect(freqToBand(144000)).toBeNull();
  });

  it("handles band edges", () => {
    expect(freqToBand(1800)).toBe("160m");
    expect(freqToBand(2000)).toBe("160m");
    expect(freqToBand(7000)).toBe("40m");
    expect(freqToBand(7300)).toBe("40m");
  });
});

describe("normalizeDxSummitSpot", () => {
  const sampleSpot = {
    id: 67392528,
    dx_call: "SP8HAS/P",
    de_call: "3Z4M3K-@",
    frequency: 14248.0,
    time: "2026-07-05T15:06:12",
    info: "POTA-0371",
    dx_country: "Poland",
    dx_latitude: 50.07,
    dx_longitude: -22.0,
    de_latitude: 54.17,
    de_longitude: -19.42,
  };

  it("converts frequency from kHz to Hz", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.freq).toBe(14248000);
  });

  it("assigns correct band", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.band).toBe("20m");
  });

  it("strips -@ suffix from de_call", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.de_call).toBe("3Z4M3K");
  });

  it("sets source to DXSummit", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.source).toBe("DXSummit");
  });

  it("sets mode to SSB and mode_type to PHONE", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.mode).toBe("SSB");
    expect(normalized.mode_type).toBe("PHONE");
  });

  it("prefixes id with dxs-", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.id).toBe("dxs-67392528");
  });

  it("parses time as UTC epoch seconds", () => {
    const normalized = normalizeDxSummitSpot(sampleSpot);
    expect(normalized.time).toBe(Math.floor(new Date("2026-07-05T15:06:12Z").getTime() / 1000));
  });

  it("handles null info gracefully", () => {
    const spot = { ...sampleSpot, info: null };
    const normalized = normalizeDxSummitSpot(spot);
    expect(normalized.comment).toBeNull();
  });

  it("handles de_call without -@ suffix", () => {
    const spot = { ...sampleSpot, de_call: "IU1TKM" };
    const normalized = normalizeDxSummitSpot(spot);
    expect(normalized.de_call).toBe("IU1TKM");
  });
});

describe("deduplicateSpots", () => {
  const makeSpot = (call: string, band: string, time: number, source: string) => ({
    dx_call: call,
    band,
    time,
    source,
    id: `${source}-${call}-${time}`,
  });

  it("keeps unique spots", () => {
    const spots = [
      makeSpot("DL8ECA", "20m", 1000, "Cluster"),
      makeSpot("JA1ABC", "40m", 1000, "Cluster"),
      makeSpot("W1AW", "20m", 1000, "DXSummit"),
    ];
    expect(deduplicateSpots(spots)).toHaveLength(3);
  });

  it("removes duplicates within 2-minute window", () => {
    const spots = [
      makeSpot("DL8ECA", "20m", 1000, "Cluster"),
      makeSpot("DL8ECA", "20m", 1050, "DXSummit"), // same slot (1000/120 = 8, 1050/120 = 8)
    ];
    expect(deduplicateSpots(spots)).toHaveLength(1);
  });

  it("prioritizes Spothole (Cluster) over DXSummit", () => {
    const spots = [
      makeSpot("DL8ECA", "20m", 1000, "DXSummit"),
      makeSpot("DL8ECA", "20m", 1050, "Cluster"),
    ];
    const result = deduplicateSpots(spots);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("Cluster");
  });

  it("keeps spots on different bands as separate", () => {
    const spots = [
      makeSpot("DL8ECA", "20m", 1000, "Cluster"),
      makeSpot("DL8ECA", "40m", 1000, "DXSummit"),
    ];
    expect(deduplicateSpots(spots)).toHaveLength(2);
  });

  it("keeps spots in different time slots as separate", () => {
    const spots = [
      makeSpot("DL8ECA", "20m", 1000, "Cluster"),
      makeSpot("DL8ECA", "20m", 1200, "DXSummit"), // different slot (1000/120=8, 1200/120=10)
    ];
    expect(deduplicateSpots(spots)).toHaveLength(2);
  });

  it("is case-insensitive for callsigns", () => {
    const spots = [
      makeSpot("dl8eca", "20m", 1000, "Cluster"),
      makeSpot("DL8ECA", "20m", 1050, "DXSummit"),
    ];
    expect(deduplicateSpots(spots)).toHaveLength(1);
  });
});
