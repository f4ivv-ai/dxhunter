import { describe, expect, it, vi } from "vitest";

vi.mock("./websdrSmart", () => ({
  getUserFavorites: vi.fn(async () => []),
  getUserDeleted: vi.fn(async () => []),
}));

import {
  angleDifference,
  frequencyMatches,
  modeToleranceKhz,
  parseKiwiStatus,
  rankCorridorReceivers,
  rankSpotCandidates,
} from "./ecouteDx";

describe("Écoute DX — tolérances de fréquence", () => {
  it("applique ±2,5 kHz en SSB", () => {
    expect(modeToleranceKhz("USB")).toBe(2.5);
    expect(frequencyMatches(14232.5, 14230, "SSB")).toBe(true);
    expect(frequencyMatches(14232.51, 14230, "SSB")).toBe(false);
  });

  it("applique ±500 Hz en CW et ±100 Hz en numérique", () => {
    expect(frequencyMatches(7025.5, 7025, "CW")).toBe(true);
    expect(frequencyMatches(7025.51, 7025, "CW")).toBe(false);
    expect(frequencyMatches(14074.1, 14074, "FT8")).toBe(true);
    expect(frequencyMatches(14074.11, 14074, "FT8")).toBe(false);
  });
});

describe("Écoute DX — état KiwiSDR", () => {
  it("parse le format key=value de l'endpoint /status", () => {
    expect(parseKiwiStatus("status=private\nname=Kiwi F4IVV\ngps=(45.3399, 5.18347)\n")).toEqual({
      status: "private",
      name: "Kiwi F4IVV",
      gps: "(45.3399, 5.18347)",
    });
  });
});

describe("Écoute DX — candidats du Cluster", () => {
  it("conserve six heures, filtre la fréquence et trie heure puis spotter/pays", () => {
    const launchedAt = Date.parse("2026-09-06T12:00:00Z");
    const candidates = rankSpotCandidates([
      { id: "old", dx_call: "OLD1", de_call: "F1OLD", freq: 14_230_000, received_time: launchedAt / 1000 - 6 * 3600 - 1 },
      { id: "far", dx_call: "FAR1", de_call: "F1FAR", freq: 14_240_000, received_time: launchedAt / 1000 - 60 },
      { id: "b", dx_call: "K1BBB", dx_country: "États-Unis", de_call: "F4ZZZ", freq: 14_231_000, received_time: launchedAt / 1000 - 30 },
      { id: "a", dx_call: "K1AAA", dx_country: "États-Unis", de_call: "F1AAA", freq: 14_229_500, received_time: launchedAt / 1000 - 30 },
    ], 14230, "SSB", launchedAt);

    expect(candidates.map((candidate) => candidate.id)).toEqual(["a", "b"]);
    expect(candidates[0]).toMatchObject({ callsign: "K1AAA", spotter: "F1AAA", deltaKhz: -0.5 });
  });
});

describe("Écoute DX — corridor des récepteurs", () => {
  it("calcule correctement la différence angulaire autour du nord", () => {
    expect(angleDifference(350, 10)).toBe(20);
    expect(angleDifference(10, 350)).toBe(-20);
  });

  it("ne retourne que des récepteurs à ±30° et les classe par score", async () => {
    const result = await rankCorridorReceivers({
      freqKhz: 14230,
      mode: "USB",
      azimuth: 300,
      path: "SP",
      visitorId: "admin-test",
      limit: 12,
    });

    expect(result.corridorBearing).toBe(300);
    expect(result.receivers.length).toBeGreaterThan(0);
    expect(result.receivers[0]).toMatchObject({
      name: "KiwiSDR F4IVV | Marcilloles (38)",
      isPriority: true,
      url: "http://23147.proxy.kiwisdr.com:8073/",
      tuneUrl: "http://23147.proxy.kiwisdr.com:8073/?f=14230.00/usb&z=10",
      embeddable: false,
      accessLabel: "Proxy Kiwi",
    });
    expect(result.receivers.every((receiver) => receiver.isPriority || Math.abs(receiver.offsetDeg) <= 30)).toBe(true);
    for (let index = 1; index < result.receivers.length; index++) {
      expect(result.receivers[index - 1].score).toBeGreaterThanOrEqual(result.receivers[index].score);
    }
    expect(result.receivers[0].tuneUrl).toContain("14230");
  });

  it("bascule le corridor à 180° en Long Path", async () => {
    const result = await rankCorridorReceivers({
      freqKhz: 7185,
      mode: "LSB",
      azimuth: 30,
      path: "LP",
      visitorId: "admin-test",
      limit: 3,
    });
    expect(result.corridorBearing).toBe(210);
  });
});
