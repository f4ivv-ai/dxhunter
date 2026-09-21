import { describe, expect, it } from "vitest";
import { matchesTarget, parseTargets, classifyMode, toSpot, isRareEntity, displayMode, type RawSpot } from "./dx";

function makeRaw(partial: Partial<RawSpot>): RawSpot {
  return {
    id: "1",
    dx_call: "TEST",
    dx_name: null,
    dx_qth: null,
    dx_country: null,
    dx_flag: null,
    dx_continent: null,
    dx_dxcc_id: null,
    dx_cq_zone: null,
    dx_latitude: null,
    dx_longitude: null,
    dx_location_good: false,
    de_call: "DE",
    de_country: null,
    de_continent: null,
    de_latitude: null,
    de_longitude: null,
    mode: null,
    mode_type: null,
    freq: 14_200_000,
    band: "20m",
    comment: null,
    qrt: false,
    time: 1_700_000_000,
    time_iso: "",
    received_time: 1_700_000_000,
    source: "Cluster",
    ...partial,
  };
}

describe("parseTargets", () => {
  it("découpe sur virgules, points-virgules et retours ligne", () => {
    expect(parseTargets("P5, 3Y; 9M0\nSpratly")).toEqual(["P5", "3Y", "9M0", "Spratly"]);
  });
  it("ignore les entrées vides et limite à 50", () => {
    expect(parseTargets("  , ,P5,  ")).toEqual(["P5"]);
    expect(parseTargets(Array.from({ length: 60 }, (_, i) => `T${i}`).join(",")).length).toBe(50);
  });
});

describe("matchesTarget", () => {
  it("matche par préfixe d'indicatif (insensible à la casse)", () => {
    expect(matchesTarget("9M0XYZ", null, ["9M0"])).toBe(true);
    expect(matchesTarget("9m0xyz", null, ["9M0"])).toBe(true);
    expect(matchesTarget("W1ABC", null, ["9M0"])).toBe(false);
  });
  it("matche par fragment de pays", () => {
    expect(matchesTarget("XX9ZZ", "Spratly Islands", ["Spratly"])).toBe(true);
    expect(matchesTarget("JA3CZY", "Japan", ["japan"])).toBe(true);
  });
  it("renvoie false si aucune cible", () => {
    expect(matchesTarget("9M0XYZ", "Spratly", [])).toBe(false);
  });
});

describe("classifyMode", () => {
  it("classe USB/LSB/SSB comme SSB", () => {
    expect(classifyMode(makeRaw({ mode: "USB", freq: 14_250_000 }))).toBe("SSB");
    expect(classifyMode(makeRaw({ mode: "LSB", freq: 7_100_000 }))).toBe("SSB");
    expect(classifyMode(makeRaw({ mode: "SSB", freq: 14_200_000 }))).toBe("SSB");
  });
  it("classe CW correctement", () => {
    expect(classifyMode(makeRaw({ mode: "CW", mode_type: "CW" }))).toBe("CW");
  });
  it("classe FT8 comme FT8 (pas DIGI)", () => {
    expect(classifyMode(makeRaw({ mode: "FT8", mode_type: "DATA" }))).toBe("FT8");
  });
  it("classe RTTY comme DIGI (pas FT8)", () => {
    expect(classifyMode(makeRaw({ mode: "RTTY", mode_type: "DATA" }))).toBe("DIGI");
  });
  it("détecte FT8 par fréquence même si mode=USB (clusters mal étiquetés)", () => {
    // 40m FT8 : 7074 kHz
    expect(classifyMode(makeRaw({ mode: "USB", freq: 7_074_000 }))).toBe("FT8");
    expect(classifyMode(makeRaw({ mode: "USB", freq: 7_077_000 }))).toBe("FT8");
    // 20m FT8 : 14074 kHz
    expect(classifyMode(makeRaw({ mode: "USB", freq: 14_074_000 }))).toBe("FT8");
    // 15m FT8 : 21074 kHz
    expect(classifyMode(makeRaw({ mode: "USB", freq: 21_074_000 }))).toBe("FT8");
    // 10m FT8 : 28074 kHz
    expect(classifyMode(makeRaw({ mode: "USB", freq: 28_074_000 }))).toBe("FT8");
  });
  it("ne classe PAS en DIGI les fréquences SSB normales", () => {
    expect(classifyMode(makeRaw({ mode: "USB", freq: 7_100_000 }))).toBe("SSB");
    expect(classifyMode(makeRaw({ mode: "USB", freq: 14_200_000 }))).toBe("SSB");
    expect(classifyMode(makeRaw({ mode: "LSB", freq: 3_700_000 }))).toBe("SSB");
  });
  it("détecte FT8/FT4 par nom de mode", () => {
    expect(classifyMode(makeRaw({ mode: "FT8" }))).toBe("FT8");
    expect(classifyMode(makeRaw({ mode: "FT4" }))).toBe("FT8");
  });
  it("classe RTTY comme DIGI (pas FT8)", () => {
    expect(classifyMode(makeRaw({ mode: "RTTY" }))).toBe("DIGI");
  });
});

describe("toSpot", () => {
  it("calcule freqKhz, famille et marque les cibles", () => {
    const s = toSpot(makeRaw({ dx_call: "9M0ABC", dx_country: "Spratly", mode: "USB" }), ["9M0"]);
    expect(s.freqKhz).toBe(14_200);
    expect(s.family).toBe("SSB");
    expect(s.isTarget).toBe(true);
  });
  it("isTarget false quand pas de cible", () => {
    const s = toSpot(makeRaw({ dx_call: "W1ABC" }), []);
    expect(s.isTarget).toBe(false);
  });
});

describe("isRareEntity", () => {
  it("détecte les préfixes rares", () => {
    expect(isRareEntity("P5RYM")).toBe(true);
    expect(isRareEntity("3Y0J")).toBe(true);
    expect(isRareEntity("W1AW")).toBe(false);
  });
});

describe("displayMode", () => {
  it("retourne LSB pour les fréquences < 10 MHz", () => {
    expect(displayMode("USB", 7050)).toBe("LSB");
    expect(displayMode("SSB", 3750)).toBe("LSB");
    expect(displayMode("LSB", 1850)).toBe("LSB");
    expect(displayMode(null, 7185)).toBe("LSB");
    expect(displayMode("", 3500)).toBe("LSB");
  });

  it("retourne USB pour les fréquences >= 10 MHz", () => {
    expect(displayMode("USB", 14250)).toBe("USB");
    expect(displayMode("SSB", 21200)).toBe("USB");
    expect(displayMode("LSB", 28500)).toBe("USB");
    expect(displayMode(null, 14195)).toBe("USB");
  });

  it("conserve les modes non-SSB tels quels", () => {
    expect(displayMode("CW", 7025)).toBe("CW");
    expect(displayMode("FT8", 14074)).toBe("FT8");
    expect(displayMode("AM", 3700)).toBe("AM");
  });
});
