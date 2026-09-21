import { describe, it, expect } from "vitest";
import {
  predictScore,
  spotsToScore,
  countSpotsByZone,
  buildSnapshot,
  calibrationAccuracy,
  learnCorrections,
  applyCorrection,
  CALIB_ZONES,
  ALL_CONTEST_BANDS,
  RawSpot,
} from "./calibration";

const solarCalm = { kp: 0, sfi: 100, aIndex: 0, blackout: null };

describe("spotsToScore", () => {
  it("renvoie 0 sans spot", () => {
    expect(spotsToScore(0)).toBe(0);
  });
  it("croît avec le nombre de spots et sature à 100", () => {
    expect(spotsToScore(1)).toBeGreaterThan(0);
    expect(spotsToScore(10)).toBeGreaterThan(spotsToScore(3));
    expect(spotsToScore(1000)).toBeLessThanOrEqual(100);
  });
  it("est monotone croissant", () => {
    let prev = -1;
    for (const n of [0, 1, 2, 5, 10, 20, 50]) {
      const s = spotsToScore(n);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("predictScore", () => {
  it("renvoie un score borné 0-100 pour toutes les bandes", () => {
    for (const band of ALL_CONTEST_BANDS) {
      for (const z of CALIB_ZONES) {
        const s = predictScore(z, new Date("2026-07-11T22:00:00Z"), solarCalm, band);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }
  });
  it("pénalise les chemins polaires quand Kp est élevé (40m)", () => {
    const scand = CALIB_ZONES.find((z) => z.id === "scand")!;
    const d = new Date("2026-07-11T22:00:00Z");
    const calm = predictScore(scand, d, { kp: 0, sfi: 100, aIndex: 0, blackout: null }, "40m");
    const storm = predictScore(scand, d, { kp: 7, sfi: 100, aIndex: 0, blackout: null }, "40m");
    expect(storm).toBeLessThan(calm);
  });
  it("160m et 80m ont des scores élevés la nuit, faibles le jour", () => {
    const night = new Date("2026-07-11T01:00:00Z");
    const day = new Date("2026-07-11T12:00:00Z");
    const eu_e = CALIB_ZONES.find((z) => z.id === "eu_e")!;
    for (const band of ["160m", "80m"] as const) {
      const nightScore = predictScore(eu_e, night, solarCalm, band);
      const dayScore = predictScore(eu_e, day, solarCalm, band);
      expect(nightScore).toBeGreaterThan(dayScore);
    }
  });
  it("20m, 15m, 10m ont des scores élevés le jour pour les zones éclairées", () => {
    const day = new Date("2026-07-11T12:00:00Z");
    const eu_e = CALIB_ZONES.find((z) => z.id === "eu_e")!;
    for (const band of ["20m", "15m", "10m"] as const) {
      const score = predictScore(eu_e, day, solarCalm, band);
      expect(score).toBeGreaterThan(30);
    }
  });
});

describe("countSpotsByZone", () => {
  it("rattache un spot à la zone la plus proche", () => {
    const spots: RawSpot[] = [
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "40m" }, // USA Est
      { dx_latitude: 35.7, dx_longitude: 139.7, band: "40m" }, // Japon
      { dx_latitude: 35.6, dx_longitude: 139.8, band: "40m" }, // Japon (proche)
    ];
    const by = countSpotsByZone(spots, "40m");
    expect(by.get("us_e")).toBe(1);
    expect(by.get("ja")).toBe(2);
  });
  it("filtre par bande quand spécifié", () => {
    const spots: RawSpot[] = [
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "40m" },
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "20m" },
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "20m" },
    ];
    const by40 = countSpotsByZone(spots, "40m");
    const by20 = countSpotsByZone(spots, "20m");
    expect(by40.get("us_e")).toBe(1);
    expect(by20.get("us_e")).toBe(2);
  });
  it("ignore les spots sans coordonnées", () => {
    const by = countSpotsByZone([{ dx_latitude: null, dx_longitude: null }]);
    let total = 0;
    for (const v of by.values()) total += v;
    expect(total).toBe(0);
  });
});

describe("buildSnapshot — multi-bandes", () => {
  it("produit 6 bandes × 14 zones = 84 lignes", () => {
    const rows = buildSnapshot([], solarCalm, new Date("2026-07-11T22:00:00Z"), "manual");
    expect(rows).toHaveLength(ALL_CONTEST_BANDS.length * CALIB_ZONES.length);
  });
  it("chaque ligne a error = predicted - actual", () => {
    const rows = buildSnapshot([], solarCalm, new Date("2026-07-11T22:00:00Z"), "manual");
    for (const r of rows) {
      expect(r.error).toBe(r.predictedScore - r.actualScore);
      expect(r.source).toBe("manual");
    }
  });
  it("inclut toutes les bandes contest", () => {
    const rows = buildSnapshot([], solarCalm, new Date("2026-07-11T22:00:00Z"), "manual");
    const bands = new Set(rows.map((r) => r.band));
    for (const b of ALL_CONTEST_BANDS) {
      expect(bands.has(b)).toBe(true);
    }
  });
  it("attribue les spots à la bonne bande", () => {
    const spots: RawSpot[] = [
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "20m" },
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "20m" },
      { dx_latitude: 40.7, dx_longitude: -74.0, band: "40m" },
    ];
    const rows = buildSnapshot(spots, solarCalm, new Date("2026-07-11T22:00:00Z"), "manual");
    const us20 = rows.find((r) => r.band === "20m" && r.zoneId === "us_e");
    const us40 = rows.find((r) => r.band === "40m" && r.zoneId === "us_e");
    expect(us20!.actualSpots).toBe(2);
    expect(us40!.actualSpots).toBe(1);
  });
});

describe("calibrationAccuracy", () => {
  it("renvoie des zéros sur ensemble vide", () => {
    expect(calibrationAccuracy([])).toEqual({ mae: 0, bias: 0, reliability: 0 });
  });
  it("calcule MAE, biais et fiabilité", () => {
    const a = calibrationAccuracy([{ error: 10 }, { error: -10 }, { error: 10 }, { error: -10 }]);
    expect(a.mae).toBe(10);
    expect(a.bias).toBe(0);
    expect(a.reliability).toBeGreaterThan(80);
  });
  it("fiabilité basse quand l'erreur est grande", () => {
    const a = calibrationAccuracy([{ error: 60 }, { error: 60 }]);
    expect(a.reliability).toBe(0);
  });
});

describe("learnCorrections + applyCorrection", () => {
  it("apprend un biais positif et le corrige vers le bas", () => {
    const today = "2026-06-30";
    const history = [
      { zoneId: "vu", error: 40, snapDate: "2026-06-30", band: "40m" },
      { zoneId: "vu", error: 40, snapDate: "2026-06-29", band: "40m" },
      { zoneId: "vu", error: 40, snapDate: "2026-06-28", band: "40m" },
      { zoneId: "vu", error: 40, snapDate: "2026-06-27", band: "40m" },
      { zoneId: "vu", error: 40, snapDate: "2026-06-26", band: "40m" },
      { zoneId: "vu", error: 40, snapDate: "2026-06-25", band: "40m" },
    ];
    const corr = learnCorrections(history, today);
    const c = corr.get("40m:vu")!;
    expect(c.bias).toBeGreaterThan(30);
    expect(c.samples).toBe(6);
    expect(c.confidence).toBe(1);
    const adjusted = applyCorrection(90, c);
    expect(adjusted).toBeLessThan(90);
  });
  it("ne corrige pas sans historique", () => {
    expect(applyCorrection(80, undefined)).toBe(80);
  });
  it("corrige faiblement avec peu d'échantillons (faible confiance)", () => {
    const corr = learnCorrections(
      [{ zoneId: "ja", error: 60, snapDate: "2026-06-30", band: "20m" }],
      "2026-06-30",
    );
    const c = corr.get("20m:ja")!;
    expect(c.confidence).toBeLessThan(0.3);
    const adjusted = applyCorrection(90, c);
    // correction partielle : reste proche de 90 (faible confiance ≈ 0.17)
    expect(adjusted).toBeGreaterThanOrEqual(78);
    expect(adjusted).toBeLessThan(90);
  });
  it("garde le score dans [0,100] après correction", () => {
    const corr = learnCorrections(
      Array.from({ length: 6 }, (_, i) => ({
        zoneId: "x",
        error: -100,
        snapDate: `2026-06-${25 + i}`,
        band: "10m",
      })),
      "2026-06-30",
    );
    const c = corr.get("10m:x")!;
    expect(applyCorrection(50, c)).toBeLessThanOrEqual(100);
    expect(applyCorrection(50, c)).toBeGreaterThanOrEqual(0);
  });
  it("sépare les corrections par bande", () => {
    const history = [
      { zoneId: "eu_e", error: 30, snapDate: "2026-06-30", band: "40m" },
      { zoneId: "eu_e", error: 30, snapDate: "2026-06-29", band: "40m" },
      { zoneId: "eu_e", error: 30, snapDate: "2026-06-28", band: "40m" },
      { zoneId: "eu_e", error: -20, snapDate: "2026-06-30", band: "20m" },
      { zoneId: "eu_e", error: -20, snapDate: "2026-06-29", band: "20m" },
      { zoneId: "eu_e", error: -20, snapDate: "2026-06-28", band: "20m" },
    ];
    const corr = learnCorrections(history, "2026-06-30");
    const c40 = corr.get("40m:eu_e")!;
    const c20 = corr.get("20m:eu_e")!;
    expect(c40.bias).toBeGreaterThan(0); // sur-estime sur 40m
    expect(c20.bias).toBeLessThan(0); // sous-estime sur 20m
  });
});

describe("predictScore — effets solaires multi-bandes", () => {
  const night = new Date("2026-07-11T01:00:00Z");

  it("Kp élevé pénalise davantage les chemins à haute latitude que les chemins bas", () => {
    const scand = CALIB_ZONES.find((z) => z.id === "scand")!;
    const zs = CALIB_ZONES.find((z) => z.id === "zs")!;
    const calmN = predictScore(scand, night, { kp: 0, sfi: 100, blackout: null }, "40m");
    const stormN = predictScore(scand, night, { kp: 7, sfi: 100, blackout: null }, "40m");
    const calmS = predictScore(zs, night, { kp: 0, sfi: 100, blackout: null }, "40m");
    const stormS = predictScore(zs, night, { kp: 7, sfi: 100, blackout: null }, "40m");
    const dropNorth = calmN - stormN;
    const dropSouth = calmS - stormS;
    expect(dropNorth).toBeGreaterThan(0);
    expect(dropNorth).toBeGreaterThan(dropSouth);
  });

  it("Kp faible (<3) n'a aucun effet", () => {
    const scand = CALIB_ZONES.find((z) => z.id === "scand")!;
    const a = predictScore(scand, night, { kp: 0, sfi: 100, blackout: null }, "40m");
    const b = predictScore(scand, night, { kp: 2, sfi: 100, blackout: null }, "40m");
    expect(a).toBe(b);
  });

  it("un SFI élevé favorise les liaisons très longues (>8000 km)", () => {
    const zl = CALIB_ZONES.find((z) => z.id === "zl")!;
    const low = predictScore(zl, night, { kp: 0, sfi: 70, blackout: null }, "40m");
    const high = predictScore(zl, night, { kp: 0, sfi: 160, blackout: null }, "40m");
    expect(high).toBeGreaterThan(low);
  });

  it("un black-out radio (R) dégrade les chemins de jour", () => {
    const day = new Date("2026-07-11T12:00:00Z");
    const eu = CALIB_ZONES.find((z) => z.id === "eu_e")!;
    const clear = predictScore(eu, day, { kp: 0, sfi: 100, blackout: null }, "20m");
    const r3 = predictScore(eu, day, { kp: 0, sfi: 100, blackout: "R3" }, "20m");
    expect(r3).toBeLessThanOrEqual(clear);
  });

  it("reste borné 0-100 même en tempête sévère cumulée", () => {
    for (const band of ALL_CONTEST_BANDS) {
      for (const z of CALIB_ZONES) {
        const s = predictScore(z, night, { kp: 9, sfi: 60, blackout: "R5" }, band);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }
  });

  it("160m est plus sensible au Kp que le 10m", () => {
    const scand = CALIB_ZONES.find((z) => z.id === "scand")!;
    const calm160 = predictScore(scand, night, { kp: 0, sfi: 100, blackout: null }, "160m");
    const storm160 = predictScore(scand, night, { kp: 7, sfi: 100, blackout: null }, "160m");
    const calm10 = predictScore(scand, new Date("2026-07-11T12:00:00Z"), { kp: 0, sfi: 100, blackout: null }, "10m");
    const storm10 = predictScore(scand, new Date("2026-07-11T12:00:00Z"), { kp: 7, sfi: 100, blackout: null }, "10m");
    const drop160 = calm160 - storm160;
    const drop10 = calm10 - storm10;
    expect(drop160).toBeGreaterThan(drop10);
  });
});
