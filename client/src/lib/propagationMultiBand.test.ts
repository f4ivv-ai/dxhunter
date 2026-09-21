import { describe, it, expect } from "vitest";
import {
  ALL_CONTEST_BANDS,
  buildBandTimeline,
  buildGeneralTimeline,
  getTickerSlots,
  ContestBand,
} from "./propagationMultiBand";
import { SolarInputs } from "./propagation";

const CALM_SOLAR: SolarInputs = { kp: 2, sfi: 130, flareClass: null, blackout: null };
const STORM_SOLAR: SolarInputs = { kp: 6, sfi: 80, flareClass: "M2.3", blackout: "R2" };

describe("propagationMultiBand", () => {
  describe("ALL_CONTEST_BANDS", () => {
    it("contient les 6 bandes contest", () => {
      expect(ALL_CONTEST_BANDS).toEqual(["160m", "80m", "40m", "20m", "15m", "10m"]);
    });
  });

  describe("buildBandTimeline", () => {
    it("retourne 24 créneaux pour chaque bande", () => {
      for (const band of ALL_CONTEST_BANDS) {
        const slots = buildBandTimeline(band, CALM_SOLAR);
        expect(slots).toHaveLength(24);
      }
    });

    it("chaque slot a les propriétés attendues", () => {
      const slots = buildBandTimeline("40m", CALM_SOLAR);
      for (const slot of slots) {
        expect(slot.hourUTC).toBeGreaterThanOrEqual(0);
        expect(slot.hourUTC).toBeLessThanOrEqual(23);
        expect(slot.band).toBe("40m");
        expect(slot.zones.length).toBeGreaterThan(0);
        expect(slot.zones.length).toBeLessThanOrEqual(4);
        expect(typeof slot.headline).toBe("string");
        expect(slot.bandScore).toBeGreaterThanOrEqual(0);
        expect(slot.bandScore).toBeLessThanOrEqual(100);
      }
    });

    it("les zones ont les champs requis", () => {
      const slots = buildBandTimeline("20m", CALM_SOLAR);
      const zone = slots[0].zones[0];
      expect(zone).toHaveProperty("label");
      expect(zone).toHaveProperty("az");
      expect(zone).toHaveProperty("cardinal");
      expect(zone).toHaveProperty("path");
      expect(zone).toHaveProperty("score");
      expect(["SP", "LP"]).toContain(zone.path);
    });

    it("le 160m est moins favorable que le 20m à 12h UTC", () => {
      const lowBand = buildBandTimeline("160m", CALM_SOLAR, 12)[0];
      const dayBand = buildBandTimeline("20m", CALM_SOLAR, 12)[0];
      // Comparaison relative stable toute l'année : le score absolu varie avec la saison.
      expect(lowBand.bandScore).toBeLessThan(dayBand.bandScore);
    });

    it("les bandes de jour (20m) ont un bon score en plein jour", () => {
      const slots = buildBandTimeline("20m", CALM_SOLAR, 12);
      const noonSlot = slots[0];
      expect(noonSlot.bandScore).toBeGreaterThan(40);
    });
  });

  describe("buildGeneralTimeline", () => {
    it("retourne 24 créneaux", () => {
      const slots = buildGeneralTimeline(CALM_SOLAR);
      expect(slots).toHaveLength(24);
    });

    it("chaque slot indique la meilleure bande", () => {
      const slots = buildGeneralTimeline(CALM_SOLAR);
      for (const slot of slots) {
        expect(ALL_CONTEST_BANDS).toContain(slot.bestBand);
        expect(slot.bands).toHaveLength(6);
        // Les bandes sont triées par score décroissant
        for (let i = 1; i < slot.bands.length; i++) {
          expect(slot.bands[i - 1].score).toBeGreaterThanOrEqual(slot.bands[i].score);
        }
      }
    });

    it("le headline est non vide", () => {
      const slots = buildGeneralTimeline(CALM_SOLAR);
      for (const slot of slots) {
        expect(slot.headline.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getTickerSlots", () => {
    it("retourne le nombre demandé de slots (mode général)", () => {
      const slots = getTickerSlots("general", CALM_SOLAR, 6);
      expect(slots).toHaveLength(6);
    });

    it("retourne le nombre demandé de slots (mode par bande)", () => {
      const slots = getTickerSlots("40m", CALM_SOLAR, 8);
      expect(slots).toHaveLength(8);
    });

    it("le premier slot est marqué isNow", () => {
      const slots = getTickerSlots("general", CALM_SOLAR, 4);
      expect(slots[0].isNow).toBe(true);
      expect(slots[1].isNow).toBe(false);
    });

    it("chaque slot a un texte non vide", () => {
      const slots = getTickerSlots("20m", CALM_SOLAR, 6);
      for (const slot of slots) {
        expect(slot.text.length).toBeGreaterThan(0);
        expect(slot.hourUTC).toBeGreaterThanOrEqual(0);
        expect(slot.hourUTC).toBeLessThanOrEqual(23);
      }
    });

    it("fonctionne avec des données solaires dégradées (tempête)", () => {
      const slots = getTickerSlots("general", STORM_SOLAR, 4);
      expect(slots).toHaveLength(4);
      // Pas de crash même avec des conditions extrêmes
    });
  });

  describe("effet du Kp sur les scores", () => {
    it("un Kp élevé réduit les scores des bandes basses", () => {
      const calm = buildBandTimeline("40m", CALM_SOLAR, 0);
      const storm = buildBandTimeline("40m", STORM_SOLAR, 0);
      // En moyenne, les scores devraient être plus bas en tempête
      const avgCalm = calm.reduce((s, sl) => s + sl.bandScore, 0) / 24;
      const avgStorm = storm.reduce((s, sl) => s + sl.bandScore, 0) / 24;
      expect(avgStorm).toBeLessThan(avgCalm);
    });
  });
});
