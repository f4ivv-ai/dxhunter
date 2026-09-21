/**
 * Tests Vitest du module de prévision propagation 40 m à 7 jours.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch pour simuler les réponses NOAA
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import après le mock
const { computeForecast7d } = await import("./forecast");

// Données de test simulant les réponses NOAA
const MOCK_27DAY = `
:Product: 27-day Space Weather Outlook Table 27DO.txt
:Issued: 2026 Jul 05 0300 UTC
#      27-day Space Weather Outlook Table
#                Issued 2026-07-05
#   UTC      Radio Flux   Planetary   Largest
#  Date       10.7 cm      A Index    Kp Index
2026 Jul 05     160           5          2
2026 Jul 06     160           5          2
2026 Jul 07     155           5          2
2026 Jul 08     155          12          4
2026 Jul 09     150          12          4
2026 Jul 10     140           8          3
2026 Jul 11     140           5          2
2026 Jul 12     135           5          2
2026 Jul 13     130           5          2
`;

const MOCK_KP_FORECAST = JSON.stringify([
  { time_tag: "2026-07-04T21:00:00", kp: 3.0, observed: "observed" },
  { time_tag: "2026-07-05T00:00:00", kp: 2.0, observed: "estimated" },
  { time_tag: "2026-07-05T03:00:00", kp: 2.33, observed: "estimated" },
  { time_tag: "2026-07-05T06:00:00", kp: 1.67, observed: "estimated" },
  { time_tag: "2026-07-05T09:00:00", kp: 1.33, observed: "estimated" },
  { time_tag: "2026-07-05T12:00:00", kp: 2.0, observed: "estimated" },
  { time_tag: "2026-07-05T15:00:00", kp: 2.33, observed: "estimated" },
  { time_tag: "2026-07-05T18:00:00", kp: 3.0, observed: "estimated" },
  { time_tag: "2026-07-05T21:00:00", kp: 4.0, observed: "estimated" },
  { time_tag: "2026-07-06T00:00:00", kp: 3.0, observed: "estimated" },
  { time_tag: "2026-07-06T03:00:00", kp: 2.67, observed: "estimated" },
  { time_tag: "2026-07-06T06:00:00", kp: 2.0, observed: "estimated" },
  { time_tag: "2026-07-06T09:00:00", kp: 1.67, observed: "estimated" },
  { time_tag: "2026-07-06T12:00:00", kp: 1.33, observed: "estimated" },
  { time_tag: "2026-07-06T15:00:00", kp: 1.33, observed: "estimated" },
  { time_tag: "2026-07-06T18:00:00", kp: 1.67, observed: "estimated" },
  { time_tag: "2026-07-06T21:00:00", kp: 2.0, observed: "estimated" },
]);

const MOCK_3DAY = `
:Product: 3-Day Forecast
:Issued: 2026 Jul 05 1230 UTC

A. NOAA Geomagnetic Activity Observation and Forecast

NOAA Kp index breakdown Jul 05-Jul 07 2026

             Jul 05       Jul 06       Jul 07
00-03UT       2.00         3.00         1.67
03-06UT       2.33         2.67         1.33

B. NOAA Solar Radiation Activity Observation and Forecast

Solar Radiation Storm Forecast for Jul 05-Jul 07 2026

              Jul 05  Jul 06  Jul 07
S1 or greater   10%     5%      5%

C. NOAA Radio Blackout Activity and Forecast

Radio Blackout Forecast for Jul 05-Jul 07 2026

              Jul 05        Jul 06        Jul 07
R1-R2           60%           40%           30%
R3 or greater   15%           10%            5%
`;

function setupMocks() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("27-day-outlook")) {
      return Promise.resolve({ text: () => Promise.resolve(MOCK_27DAY) });
    }
    if (url.includes("planetary-k-index-forecast")) {
      return Promise.resolve({ json: () => Promise.resolve(JSON.parse(MOCK_KP_FORECAST)) });
    }
    if (url.includes("3-day-forecast")) {
      return Promise.resolve({ text: () => Promise.resolve(MOCK_3DAY) });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe("forecast.ts — computeForecast7d", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
    setupMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retourne 7 jours de prévision", async () => {
    const result = await computeForecast7d();
    expect(result.days).toHaveLength(7);
    expect(result.fetchedAt).toBeGreaterThan(0);
  });

  it("les dates commencent à aujourd'hui", async () => {
    const result = await computeForecast7d();
    expect(result.days[0].date).toBe("2026-07-05");
  });

  it("chaque jour contient les paramètres solaires", async () => {
    const result = await computeForecast7d();
    for (const day of result.days) {
      expect(day.sfi).toBeGreaterThan(0);
      expect(day.aIndex).toBeGreaterThanOrEqual(0);
      expect(day.kpMax).toBeGreaterThanOrEqual(0);
    }
  });

  it("chaque jour contient 14 zones", async () => {
    const result = await computeForecast7d();
    for (const day of result.days) {
      expect(day.zones).toHaveLength(14);
    }
  });

  it("chaque zone a 4 créneaux de score", async () => {
    const result = await computeForecast7d();
    for (const zone of result.days[0].zones) {
      expect(zone.scores).toHaveLength(4);
      for (const s of zone.scores) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }
  });

  it("le globalScore est la moyenne des zones", async () => {
    const result = await computeForecast7d();
    const day = result.days[0];
    const expected = Math.round(day.zones.reduce((s, z) => s + z.avg, 0) / day.zones.length);
    expect(day.globalScore).toBe(expected);
  });

  it("le verdict correspond au score global", async () => {
    const result = await computeForecast7d();
    for (const day of result.days) {
      if (day.globalScore >= 70) expect(day.verdict).toBe("Excellent");
      else if (day.globalScore >= 55) expect(day.verdict).toBe("Bon");
      else if (day.globalScore >= 40) expect(day.verdict).toBe("Moyen");
      else if (day.globalScore >= 25) expect(day.verdict).toBe("Dégradé");
      else expect(day.verdict).toBe("Mauvais");
    }
  });

  it("le Kp 3h détaillé est utilisé quand disponible", async () => {
    const result = await computeForecast7d();
    // Jul 05 a des données Kp 3h détaillées
    const day05 = result.days.find((d) => d.date === "2026-07-05");
    expect(day05).toBeDefined();
    // Le kpMax devrait refléter le max des créneaux (4.0)
    expect(day05!.kpMax).toBe(4);
  });

  it("les probabilités d'éruptions sont intégrées depuis le 3-day forecast", async () => {
    const result = await computeForecast7d();
    const day05 = result.days.find((d) => d.date === "2026-07-05");
    expect(day05).toBeDefined();
    // R1-R2 = 60% → flare.m = 60, R3+ = 15% → flare.x = 15
    expect(day05!.flareProb.m).toBe(60);
    expect(day05!.flareProb.x).toBe(15);
    expect(day05!.flareProb.c).toBe(90); // min(99, 60+30)
    expect(day05!.blackoutProb.r1r2).toBe(60);
    expect(day05!.blackoutProb.r3plus).toBe(15);
  });

  it("le risque est évalué correctement", async () => {
    const result = await computeForecast7d();
    // Jul 08 a Kp=4 → risk medium pour la plupart des zones
    const day08 = result.days.find((d) => d.date === "2026-07-08");
    expect(day08).toBeDefined();
    const risks = day08!.zones.map((z) => z.risk);
    expect(risks).toContain("medium");
  });

  it("ne retourne pas de NaN dans les probabilités", async () => {
    const result = await computeForecast7d();
    for (const day of result.days) {
      expect(Number.isNaN(day.flareProb.c)).toBe(false);
      expect(Number.isNaN(day.flareProb.m)).toBe(false);
      expect(Number.isNaN(day.flareProb.x)).toBe(false);
      expect(Number.isNaN(day.blackoutProb.r1r2)).toBe(false);
      expect(Number.isNaN(day.blackoutProb.r3plus)).toBe(false);
    }
  });

  it("les jours au-delà du 3-day forecast ont des probabilités estimées (pas NaN)", async () => {
    const result = await computeForecast7d();
    // Jul 10 n'est pas dans le 3-day forecast
    const day10 = result.days.find((d) => d.date === "2026-07-10");
    expect(day10).toBeDefined();
    expect(day10!.flareProb.m).toBeGreaterThanOrEqual(0);
    expect(day10!.flareProb.x).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(day10!.flareProb.x)).toBe(false);
  });
});
