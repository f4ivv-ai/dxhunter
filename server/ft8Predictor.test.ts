import { describe, expect, it } from "vitest";
import { blendNoaaFt8Score, scoreFt8History, snrToScore } from "./ft8Predictor";
import type { PropagationFt8Hourly } from "../drizzle/schema";

function row(overrides: Partial<PropagationFt8Hourly>): PropagationFt8Hourly {
  return {
    id: 1,
    snapDate: new Date().toISOString().slice(0, 10),
    hourUtc: 12,
    minuteUtc: 0,
    band: "40m",
    continent: "NA",
    spotCount: 0,
    avgSnr: null,
    maxSnr: null,
    dominantAzimuth: null,
    sfi: 130,
    kp: 2,
    source: "auto",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("FT8 Predictor — qualité et confiance", () => {
  it("respecte l’échelle SNR documentée", () => {
    expect(snrToScore(-9)).toBe(0);
    expect(snrToScore(-8)).toBe(30);
    expect(snrToScore(0)).toBe(60);
    expect(snrToScore(10)).toBe(90);
    expect(snrToScore(20)).toBe(100);
  });

  it("utilise les fermetures dans le score et limite la confiance avec peu d’échantillons", () => {
    const history = [
      row({ id: 1, minuteUtc: 0, spotCount: 8, avgSnr: 0 }),
      row({ id: 2, minuteUtc: 15, spotCount: 0, avgSnr: null }),
      row({ id: 3, minuteUtc: 30, spotCount: 0, avgSnr: null }),
      row({ id: 4, minuteUtc: 45, spotCount: 8, avgSnr: 0 }),
    ];
    const result = scoreFt8History(history, "NA", 130, 2);
    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(40);
    expect(result.confidence).toBeCloseTo(4 / 56, 4);
  });

  it("augmente progressivement le poids FT8 avec la couverture", () => {
    expect(blendNoaaFt8Score(80, 20, 0)).toBe(68);
    expect(blendNoaaFt8Score(80, 20, 1)).toBe(44);
  });
});
