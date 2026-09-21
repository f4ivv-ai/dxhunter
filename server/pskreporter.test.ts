import { describe, it, expect, beforeEach } from "vitest";
import {
  getPropagationSummary,
  getBandPropagation,
  CONTEST_BANDS,
  _getSpots,
  selectPropagationSpotsForCapture,
  _testInjectSpot,
  _testReset,
} from "./pskreporter";
import {
  F4IVV_RX_TOPIC,
  F4IVV_TX_TOPIC,
  PRIMARY_KIWI,
} from "../shared/primaryKiwi";

describe("PSK Reporter — propagation FT8", () => {
  beforeEach(() => {
    _testReset();
  });

  it("getPropagationSummary retourne une structure valide à vide", () => {
    const result = getPropagationSummary();
    expect(result).toHaveProperty("bands");
    expect(result).toHaveProperty("connected");
    expect(result).toHaveProperty("lastUpdate");
    for (const band of CONTEST_BANDS) {
      expect(result.bands[band]).toHaveProperty("total");
      expect(result.bands[band].total).toBe(0);
      expect(result.bands[band]).toHaveProperty("continents");
    }
  });

  it("getBandPropagation retourne les données pour une bande", () => {
    const result = getBandPropagation("40m");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("continents");
    expect(result.total).toBe(0);
  });

  it("injecte un spot et le retrouve dans le résumé", () => {
    _testInjectSpot({ band: "40m", continent: "NA", snr: 5 });
    _testInjectSpot({ band: "40m", continent: "NA", snr: 10 });
    _testInjectSpot({ band: "40m", continent: "EU", snr: 3 });
    _testInjectSpot({ band: "20m", continent: "AS", snr: 8 });

    const summary = getPropagationSummary();
    expect(summary.bands["40m"].total).toBe(3);
    expect(summary.bands["40m"].continents["NA"]?.count).toBe(2);
    expect(summary.bands["40m"].continents["NA"]?.avgSnr).toBe(8); // (5+10)/2 = 7.5 → arrondi 8
    expect(summary.bands["40m"].continents["NA"]?.maxSnr).toBe(10);
    expect(summary.bands["40m"].continents["EU"]?.count).toBe(1);
    expect(summary.bands["20m"].total).toBe(1);
    expect(summary.bands["20m"].continents["AS"]?.count).toBe(1);
  });

  it("filtre les spots avec SNR trop bas (< -18)", () => {
    _testInjectSpot({ band: "40m", continent: "NA", snr: -20 });
    _testInjectSpot({ band: "40m", continent: "NA", snr: -25 });
    _testInjectSpot({ band: "40m", continent: "NA", snr: -10 });

    const summary = getPropagationSummary();
    // Seul le spot avec SNR -10 devrait passer (> -18)
    expect(summary.bands["40m"].total).toBe(1);
    expect(summary.bands["40m"].continents["NA"]?.count).toBe(1);
  });

  it("CONTEST_BANDS contient les 6 bandes contest", () => {
    expect(CONTEST_BANDS).toEqual(["160m", "80m", "40m", "20m", "15m", "10m"]);
  });

  it("utilise l'adresse et les filtres exacts du Kiwi F4IVV", () => {
    expect(PRIMARY_KIWI.url).toBe("http://23147.proxy.kiwisdr.com:8073/");
    expect(F4IVV_TX_TOPIC).toBe("pskr/filter/v2/+/+/F4IVV/+/+/+/+/+");
    expect(F4IVV_RX_TOPIC).toBe("pskr/filter/v2/+/+/+/F4IVV/+/+/+/+");
  });

  it("getBandPropagation retourne les données injectées", () => {
    _testInjectSpot({ band: "20m", continent: "AF", snr: 12 });
    _testInjectSpot({ band: "20m", continent: "OC", snr: 6 });

    const result = getBandPropagation("20m");
    expect(result.total).toBe(2);
    expect(result.continents["AF"]?.count).toBe(1);
    expect(result.continents["AF"]?.maxSnr).toBe(12);
    expect(result.continents["OC"]?.count).toBe(1);
  });

  it("reset efface toutes les données", () => {
    _testInjectSpot({ band: "10m", continent: "SA", snr: 15 });
    expect(getPropagationSummary().bands["10m"].total).toBe(1);

    _testReset();
    expect(getPropagationSummary().bands["10m"].total).toBe(0);
  });

  it("gère les 6 continents", () => {
    const continents = ["EU", "AS", "NA", "SA", "AF", "OC"];
    for (const c of continents) {
      _testInjectSpot({ band: "15m", continent: c, snr: 5 });
    }
    const result = getBandPropagation("15m");
    expect(result.total).toBe(6);
    for (const c of continents) {
      expect(result.continents[c]?.count).toBe(1);
    }
  });

  it("priorise les réceptions F4IVV pour les captures", () => {
    _testInjectSpot({ band: "20m", continent: "NA", snr: -4, rxCall: "F4IVV", rxGrid: "JN25oi" });
    _testInjectSpot({ band: "20m", continent: "EU", snr: 2, rxCall: "F1ABC", rxGrid: "JN25aa" });
    _testInjectSpot({ band: "20m", continent: "AS", snr: 4, rxCall: "F2ABC", rxGrid: "JN18aa" });

    const selected = selectPropagationSpotsForCapture(_getSpots());
    expect(selected.source).toBe("F4IVV");
    expect(selected.spots).toHaveLength(1);
    expect(selected.spots[0]?.rxCall).toBe("F4IVV");
  });

  it("se replie sur JN25 puis ITU 27 si F4IVV ne publie pas", () => {
    _testInjectSpot({ band: "40m", continent: "NA", snr: -3, rxCall: "F1LOCAL", rxGrid: "JN25ab" });
    _testInjectSpot({ band: "40m", continent: "EU", snr: 1, rxCall: "F2REG", rxGrid: "JN18aa", rxItuZone: 27 });
    let selected = selectPropagationSpotsForCapture(_getSpots());
    expect(selected.source).toBe("JN25");
    expect(selected.spots).toHaveLength(1);

    _testReset();
    _testInjectSpot({ band: "40m", continent: "EU", snr: 1, rxCall: "F2REG", rxGrid: "JN18aa", rxItuZone: 27 });
    selected = selectPropagationSpotsForCapture(_getSpots());
    expect(selected.source).toBe("ITU27");
  });
});
