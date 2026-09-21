import { describe, expect, it } from "vitest";
import {
  locatorToLatLon,
  bearingDistance,
  longPath,
  azToCardinal,
  subsolarPoint,
  solarElevation,
  evaluateAllZones,
  sunTimesQTH,
  QTH,
} from "./propagation";

describe("propagation — géométrie", () => {
  it("convertit JN25PG en ~45.27N / 5.29E", () => {
    const { lat, lon } = locatorToLatLon("JN25PG");
    expect(lat).toBeCloseTo(45.27, 1);
    expect(lon).toBeCloseTo(5.29, 1);
  });

  it("calcule l'azimut SP vers le Japon proche de 35° et le LP proche de 215°", () => {
    const { bearing, distance } = bearingDistance(QTH.lat, QTH.lon, 35.7, 139.7);
    expect(bearing).toBeGreaterThan(25);
    expect(bearing).toBeLessThan(45);
    expect(longPath(bearing)).toBeCloseTo((bearing + 180) % 360, 5);
    expect(distance).toBeGreaterThan(9000);
    expect(distance).toBeLessThan(11000);
  });

  it("convertit un azimut en cardinal", () => {
    expect(azToCardinal(0)).toBe("N");
    expect(azToCardinal(90)).toBe("E");
    expect(azToCardinal(180)).toBe("S");
    expect(azToCardinal(270)).toBe("O");
  });
});

describe("propagation — solaire", () => {
  it("place le point subsolaire dans la plage de déclinaison saisonnière", () => {
    const sub = subsolarPoint(new Date("2026-07-11T12:00:00Z"));
    // en juillet la déclinaison est positive (~21-22°)
    expect(sub.lat).toBeGreaterThan(15);
    expect(sub.lat).toBeLessThan(24);
    expect(sub.lon).toBeGreaterThanOrEqual(-180);
    expect(sub.lon).toBeLessThanOrEqual(180);
  });

  it("donne une élévation solaire élevée à midi local au QTH en été", () => {
    // midi solaire au QTH ~ 11:40 UTC ; testons 11:30 UTC
    const el = solarElevation(QTH.lat, QTH.lon, new Date("2026-07-11T11:30:00Z"));
    expect(el).toBeGreaterThan(50);
  });

  it("calcule un lever et un coucher cohérents au QTH en juillet", () => {
    const { sunrise, sunset } = sunTimesQTH(new Date("2026-07-11T12:00:00Z"));
    expect(sunrise).not.toBeNull();
    expect(sunset).not.toBeNull();
    // lever tôt le matin UTC (~4h), coucher en soirée UTC (~19h)
    expect(sunrise!.getUTCHours()).toBeLessThan(6);
    expect(sunset!.getUTCHours()).toBeGreaterThan(17);
  });
});

describe("propagation — modèle d'ouverture 40 m", () => {
  it("favorise le DX la nuit/grayline plutôt qu'en plein jour (cas Moyen-Orient à l'est)", () => {
    // 23:00 UTC : nuit au QTH ET côté Moyen-Orient -> faible absorption des deux côtés
    const night = evaluateAllZones(new Date("2026-07-11T23:00:00Z"), 2);
    // 12:00 UTC : plein jour au QTH et côté cible -> absorption D forte
    const day = evaluateAllZones(new Date("2026-07-11T12:00:00Z"), 2);
    const meNight = night.find((z) => z.zone.id === "me")!;
    const meDay = day.find((z) => z.zone.id === "me")!;
    expect(meNight.score).toBeGreaterThan(meDay.score);
  });

  it("recommande le long path pour les trajets antipodaux (ZL)", () => {
    const zones = evaluateAllZones(new Date("2026-07-12T03:00:00Z"), 2);
    const zl = zones.find((z) => z.zone.id === "zl")!;
    expect(zl.path).toBe("LP");
  });

  it("pénalise les trajets nord quand le K est élevé", () => {
    const calm = evaluateAllZones(new Date("2026-07-12T01:00:00Z"), 1);
    const storm = evaluateAllZones(new Date("2026-07-12T01:00:00Z"), 6);
    const scandCalm = calm.find((z) => z.zone.id === "scand")!;
    const scandStorm = storm.find((z) => z.zone.id === "scand")!;
    expect(scandStorm.score).toBeLessThan(scandCalm.score);
  });
});
