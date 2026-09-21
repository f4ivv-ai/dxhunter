import { describe, it, expect } from "vitest";
import {
  extractWpxPrefix,
  extractWpxMultipliers,
  extractCqWwMultipliers,
  extractIaruMultipliers,
  extractRefMultipliers,
  cqZoneFromLatLon,
  FR_DEPARTMENTS,
  FR_DOMTOM,
  SpotLike,
} from "../shared/contestMultipliers";
import { ituZoneFromLatLon, hqFromCallsign, looksLikeHQ } from "../client/src/lib/multipliers";

// Helper pour créer un spot minimal
function mkSpot(overrides: Partial<SpotLike> & { dx_call: string }): SpotLike {
  return {
    dx_country: null,
    dx_dxcc_id: null,
    dx_cq_zone: null,
    dx_latitude: null,
    dx_longitude: null,
    dx_continent: null,
    band: "40m",
    mode: "SSB",
    mode_type: "PHONE",
    comment: null,
    de_call: "F4IVV",
    freq: 7100000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// extractWpxPrefix
// ---------------------------------------------------------------------------
describe("extractWpxPrefix", () => {
  it("extrait le préfixe standard", () => {
    expect(extractWpxPrefix("N8BJQ")).toBe("N8");
    expect(extractWpxPrefix("W1AW")).toBe("W1");
    expect(extractWpxPrefix("DL8ABC")).toBe("DL8");
    expect(extractWpxPrefix("HG19IPA")).toBe("HG19");
    expect(extractWpxPrefix("OE25XYZ")).toBe("OE25");
  });

  it("gère les indicatifs portables", () => {
    expect(extractWpxPrefix("PA/N8BJQ")).toBe("PA0");
    expect(extractWpxPrefix("F6ABC/P")).toBe("F6");
  });

  it("gère les indicatifs sans chiffre", () => {
    const result = extractWpxPrefix("ABCD");
    expect(result).toContain("0"); // doit ajouter un 0
  });

  it("retourne une chaîne vide pour un call vide", () => {
    expect(extractWpxPrefix("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// cqZoneFromLatLon
// ---------------------------------------------------------------------------
describe("cqZoneFromLatLon", () => {
  it("détecte la zone CQ de la France (zone 14)", () => {
    const zone = cqZoneFromLatLon(48.85, 2.35); // Paris
    expect(zone).toBe(14);
  });

  it("détecte la zone CQ des USA Est (zone 5)", () => {
    const zone = cqZoneFromLatLon(40.7, -74.0); // New York
    expect(zone).toBe(5);
  });

  it("détecte la zone CQ du Japon (zone 25)", () => {
    const zone = cqZoneFromLatLon(35.7, 139.7); // Tokyo
    expect(zone).toBe(25);
  });

  it("détecte la zone CQ de l'Australie (zone 29)", () => {
    const zone = cqZoneFromLatLon(-33.9, 151.2); // Sydney
    expect(zone).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// extractWpxMultipliers
// ---------------------------------------------------------------------------
describe("extractWpxMultipliers", () => {
  it("compte les préfixes uniques toutes bandes confondues", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "W1AW", band: "20m" }),
      mkSpot({ dx_call: "W1XYZ", band: "40m" }), // même préfixe W1
      mkSpot({ dx_call: "DL8ABC", band: "20m" }),
      mkSpot({ dx_call: "JA1XYZ", band: "15m" }),
    ];
    const result = extractWpxMultipliers(spots);
    expect(result.contestId).toBe("CQ_WPX");
    expect(result.totalUnique).toBe(3); // W1, DL8, JA1
  });

  it("regroupe les stations sous le même préfixe", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "W1AW" }),
      mkSpot({ dx_call: "W1XYZ" }),
      mkSpot({ dx_call: "W1ABC" }),
    ];
    const result = extractWpxMultipliers(spots);
    expect(result.totalUnique).toBe(1);
    const w1 = result.multipliers.find((m) => m.id === "W1");
    expect(w1).toBeDefined();
    expect(w1!.calls).toHaveLength(3);
    expect(w1!.spotCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// extractCqWwMultipliers
// ---------------------------------------------------------------------------
describe("extractCqWwMultipliers", () => {
  it("compte les zones CQ et pays DXCC par bande", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "W1AW", dx_cq_zone: 5, dx_country: "United States", band: "20m" }),
      mkSpot({ dx_call: "DL8ABC", dx_cq_zone: 14, dx_country: "Fed. Rep. of Germany", band: "20m" }),
      mkSpot({ dx_call: "JA1XYZ", dx_cq_zone: 25, dx_country: "Japan", band: "20m" }),
      mkSpot({ dx_call: "W2ABC", dx_cq_zone: 5, dx_country: "United States", band: "40m" }), // même zone, autre bande
    ];
    const result = extractCqWwMultipliers(spots);
    expect(result.contestId).toBe("CQ_WW");
    // Zones : Z5_20m, Z14_20m, Z25_20m, Z5_40m = 4
    // Pays : US_20m, DE_20m, JA_20m, US_40m = 4
    expect(result.totalUnique).toBe(8);
  });

  it("utilise dx_cq_zone du spot quand disponible", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "W1AW", dx_cq_zone: 5, dx_country: "United States", band: "20m" }),
    ];
    const result = extractCqWwMultipliers(spots);
    const zone = result.multipliers.find((m) => m.type === "cq_zone");
    expect(zone).toBeDefined();
    expect(zone!.label).toBe("Zone 5");
  });

  it("estime la zone CQ par lat/lon si dx_cq_zone manquant", () => {
    const spots: SpotLike[] = [
      mkSpot({
        dx_call: "DL8ABC",
        dx_cq_zone: null,
        dx_latitude: 51.0,
        dx_longitude: 10.0,
        dx_country: "Fed. Rep. of Germany",
        band: "20m",
      }),
    ];
    const result = extractCqWwMultipliers(spots);
    const zone = result.multipliers.find((m) => m.type === "cq_zone");
    expect(zone).toBeDefined();
    expect(zone!.label).toBe("Zone 14");
  });
});

// ---------------------------------------------------------------------------
// extractIaruMultipliers
// ---------------------------------------------------------------------------
describe("extractIaruMultipliers", () => {
  it("détecte les zones ITU et stations HQ", () => {
    const spots: SpotLike[] = [
      mkSpot({
        dx_call: "TM0HQ",
        dx_latitude: 48.85,
        dx_longitude: 2.35,
        comment: "IARU HQ REF",
        band: "40m",
      }),
      mkSpot({
        dx_call: "W1AW",
        dx_latitude: 41.7,
        dx_longitude: -72.7,
        comment: "IARU HQ ARRL",
        band: "20m",
      }),
      mkSpot({
        dx_call: "DL8ABC",
        dx_latitude: 51.0,
        dx_longitude: 10.0,
        band: "40m",
      }),
    ];
    const result = extractIaruMultipliers(spots, ituZoneFromLatLon, hqFromCallsign, looksLikeHQ);
    expect(result.contestId).toBe("IARU_HFC");
    // Au moins des zones ITU et des HQ
    const hqMults = result.multipliers.filter((m) => m.type === "hq_station");
    expect(hqMults.length).toBeGreaterThanOrEqual(1);
    const ituMults = result.multipliers.filter((m) => m.type === "itu_zone");
    expect(ituMults.length).toBeGreaterThanOrEqual(1);
  });

  it("reconnaît TM0HQ comme station HQ REF", () => {
    const spots: SpotLike[] = [
      mkSpot({
        dx_call: "TM0HQ",
        dx_latitude: 48.85,
        dx_longitude: 2.35,
        comment: "HQ",
        band: "40m",
      }),
    ];
    const result = extractIaruMultipliers(spots, ituZoneFromLatLon, hqFromCallsign, looksLikeHQ);
    const hq = result.multipliers.find((m) => m.type === "hq_station");
    expect(hq).toBeDefined();
    expect(hq!.label).toBe("REF");
  });
});

// ---------------------------------------------------------------------------
// extractRefMultipliers
// ---------------------------------------------------------------------------
describe("extractRefMultipliers", () => {
  it("détecte les DOM/TOM par préfixe", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "FG8ABC", band: "20m" }),
      mkSpot({ dx_call: "FM5XYZ", band: "40m" }),
    ];
    const result = extractRefMultipliers(spots);
    expect(result.contestId).toBe("COUPE_REF");
    const domtom = result.multipliers.filter((m) => m.type === "domtom");
    expect(domtom.length).toBeGreaterThanOrEqual(2);
  });

  it("détecte les pays DXCC non-français", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "DL8ABC", dx_country: "Fed. Rep. of Germany", band: "20m" }),
      mkSpot({ dx_call: "W1AW", dx_country: "United States", band: "20m" }),
    ];
    const result = extractRefMultipliers(spots);
    const countries = result.multipliers.filter((m) => m.type === "country");
    expect(countries.length).toBe(2);
  });

  it("détecte F6REF comme département 00", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "F6REF", band: "40m" }),
    ];
    const result = extractRefMultipliers(spots);
    const dept = result.multipliers.find((m) => m.type === "department" && m.id.includes("00"));
    expect(dept).toBeDefined();
  });

  it("extrait le département du commentaire RST+dept", () => {
    const spots: SpotLike[] = [
      mkSpot({ dx_call: "F4ABC", comment: "599 75", band: "20m" }),
    ];
    const result = extractRefMultipliers(spots);
    const dept = result.multipliers.find((m) => m.type === "department" && m.id.includes("75"));
    expect(dept).toBeDefined();
    expect(dept!.label).toBe("Dept 75");
  });
});

// ---------------------------------------------------------------------------
// Données de référence
// ---------------------------------------------------------------------------
describe("Données de référence", () => {
  it("FR_DEPARTMENTS contient 97 départements", () => {
    expect(FR_DEPARTMENTS.length).toBe(96); // 95 depts + 2A + 2B (Corse) - pas de 20
    expect(FR_DEPARTMENTS).toContain("75"); // Paris
    expect(FR_DEPARTMENTS).toContain("2A"); // Corse
    expect(FR_DEPARTMENTS).toContain("2B"); // Corse
  });

  it("FR_DOMTOM contient les principaux DOM/TOM", () => {
    expect(FR_DOMTOM.length).toBeGreaterThanOrEqual(10);
    expect(FR_DOMTOM.find((d) => d.prefix === "FG")).toBeDefined(); // Guadeloupe
    expect(FR_DOMTOM.find((d) => d.prefix === "FM")).toBeDefined(); // Martinique
    expect(FR_DOMTOM.find((d) => d.prefix === "FR")).toBeDefined(); // Réunion
  });
});

// ---------------------------------------------------------------------------
// IOTA Contest — extraction de références IOTA
// ---------------------------------------------------------------------------
import { extractIotaRef, CONTESTS } from "./contestRules";

describe("extractIotaRef", () => {
  it("extrait une référence IOTA standard (EU-005)", () => {
    expect(extractIotaRef("IOTA EU-005")).toBe("EU-005");
  });

  it("extrait une référence IOTA sans tiret (EU005)", () => {
    expect(extractIotaRef("EU005")).toBe("EU-005");
  });

  it("extrait une référence IOTA dans un commentaire long", () => {
    expect(extractIotaRef("up 5 IOTA AF-032 QSL via bureau")).toBe("AF-032");
  });

  it("extrait une référence IOTA avec espace (NA 065)", () => {
    expect(extractIotaRef("NA 065")).toBe("NA-065");
  });

  it("extrait les différents continents", () => {
    expect(extractIotaRef("SA-001")).toBe("SA-001");
    expect(extractIotaRef("OC-001")).toBe("OC-001");
    expect(extractIotaRef("AS-001")).toBe("AS-001");
    expect(extractIotaRef("AN-001")).toBe("AN-001");
  });

  it("retourne null si pas de référence IOTA", () => {
    expect(extractIotaRef("CQ CQ de F4IVV")).toBeNull();
    expect(extractIotaRef("")).toBeNull();
    expect(extractIotaRef("59 001")).toBeNull();
  });
});

describe("IOTA contest extractMultipliers", () => {
  const iota = CONTESTS["IOTA"];

  it("extrait un multiplicateur IOTA depuis l'échange", () => {
    const result = iota.extractMultipliers({
      call: "SV9CVY",
      band: "20",
      mode: "SSB",
      exchange: "EU-015",
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("iota");
    expect(result[0].value).toBe("EU-015:SSB");
    expect(result[0].band).toBe("20");
  });

  it("extrait un multiplicateur IOTA depuis le commentaire", () => {
    const result = iota.extractMultipliers({
      call: "VK4DX",
      band: "15",
      mode: "CW",
      comment: "IOTA OC-137 up 2",
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("iota");
    expect(result[0].value).toBe("OC-137:CW");
  });

  it("extrait un multiplicateur IOTA depuis iotaRef explicite", () => {
    const result = iota.extractMultipliers({
      call: "GJ3YHU",
      band: "40",
      mode: "SSB",
      iotaRef: "EU-013",
    });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("EU-013:SSB");
  });

  it("retourne vide si pas de référence IOTA", () => {
    const result = iota.extractMultipliers({
      call: "DL1ABC",
      band: "20",
      mode: "SSB",
    });
    expect(result).toHaveLength(0);
  });

  it("sépare CW et SSB pour le même IOTA ref", () => {
    const ssb = iota.extractMultipliers({
      call: "SV9CVY",
      band: "20",
      mode: "SSB",
      exchange: "EU-015",
    });
    const cw = iota.extractMultipliers({
      call: "SV9CVY",
      band: "20",
      mode: "CW",
      exchange: "EU-015",
    });
    expect(ssb[0].value).toBe("EU-015:SSB");
    expect(cw[0].value).toBe("EU-015:CW");
    expect(ssb[0].value).not.toBe(cw[0].value);
  });
});
