/**
 * Modèle de propagation multi-bandes pour le pilotage contest.
 * Adapte les recommandations horaires selon les caractéristiques de chaque bande :
 * - 160m / 80m : bandes de nuit (absorption D très forte le jour)
 * - 40m : bande mixte (run EU jour, DX nuit)
 * - 20m : bande principale de jour (DX mondial le jour, ferme la nuit en été)
 * - 15m : bande de jour haute (ouvre avec SFI élevé, DX mondial)
 * - 10m : bande de jour (ouvre sporadique E + F2 avec SFI élevé)
 *
 * QTH de référence : JN25PG (45.27°N, 5.29°E)
 */

import {
  QTH as DEFAULT_QTH,
  ZONES,
  Zone,
  dayState,
  DayState,
  bearingDistance,
  azToCardinal,
  solarElevation,
  SolarInputs,
} from "./propagation";

/** QTH coordinates used for propagation calculations */
export interface QthCoords {
  lat: number;
  lon: number;
}

export type ContestBand = "160m" | "80m" | "40m" | "20m" | "15m" | "10m";
export const ALL_CONTEST_BANDS: ContestBand[] = ["160m", "80m", "40m", "20m", "15m", "10m"];

/** Caractéristiques de propagation par bande */
interface BandProfile {
  band: ContestBand;
  /** Fréquence typique en MHz */
  freqMhz: number;
  /** La bande est principalement nocturne ? */
  nightBand: boolean;
  /** La bande est principalement diurne ? */
  dayBand: boolean;
  /** Distance max typique de jour (km) */
  dayMaxKm: number;
  /** Distance max typique de nuit (km) */
  nightMaxKm: number;
  /** Sensibilité au Kp (0-1, 1=très sensible) */
  kpSensitivity: number;
  /** Bonus SFI (bandes hautes bénéficient plus du SFI élevé) */
  sfiBonus: number;
}

const BAND_PROFILES: Record<ContestBand, BandProfile> = {
  "160m": { band: "160m", freqMhz: 1.8, nightBand: true, dayBand: false, dayMaxKm: 500, nightMaxKm: 12000, kpSensitivity: 0.9, sfiBonus: 0 },
  "80m": { band: "80m", freqMhz: 3.5, nightBand: true, dayBand: false, dayMaxKm: 1500, nightMaxKm: 15000, kpSensitivity: 0.7, sfiBonus: 0.1 },
  "40m": { band: "40m", freqMhz: 7.0, nightBand: false, dayBand: false, dayMaxKm: 2500, nightMaxKm: 20000, kpSensitivity: 0.5, sfiBonus: 0.2 },
  "20m": { band: "20m", freqMhz: 14.0, nightBand: false, dayBand: true, dayMaxKm: 20000, nightMaxKm: 5000, kpSensitivity: 0.3, sfiBonus: 0.5 },
  "15m": { band: "15m", freqMhz: 21.0, nightBand: false, dayBand: true, dayMaxKm: 20000, nightMaxKm: 2000, kpSensitivity: 0.2, sfiBonus: 0.8 },
  "10m": { band: "10m", freqMhz: 28.0, nightBand: false, dayBand: true, dayMaxKm: 20000, nightMaxKm: 1000, kpSensitivity: 0.1, sfiBonus: 1.0 },
};

export interface BandTimelineSlot {
  hourUTC: number;
  band: ContestBand;
  /** Zones recommandées triées par score */
  zones: { label: string; az: number; cardinal: string; path: "SP" | "LP"; score: number }[];
  /** Résumé textuel court pour le bandeau défilant */
  headline: string;
  /** Score global d'ouverture de la bande à cette heure (0-100) */
  bandScore: number;
}

export interface GeneralTimelineSlot {
  hourUTC: number;
  /** Meilleure bande à cette heure */
  bestBand: ContestBand;
  /** Toutes les bandes avec leur score */
  bands: { band: ContestBand; score: number; headline: string; topZone: string; topAz: number; topPath: "SP" | "LP" }[];
  /** Résumé textuel pour le bandeau défilant */
  headline: string;
}

/**
 * Évalue le score d'ouverture d'une zone pour une bande donnée à une heure donnée.
 */
function evaluateZoneBand(
  zone: Zone,
  date: Date,
  band: ContestBand,
  solar: SolarInputs,
  qth: QthCoords = DEFAULT_QTH
): { score: number; path: "SP" | "LP"; reason: string } {
  const profile = BAND_PROFILES[band];
  const { bearing: spAz, distance } = bearingDistance(qth.lat, qth.lon, zone.lat, zone.lon);
  const qthState = dayState(qth.lat, qth.lon, date);
  const targetState = dayState(zone.lat, zone.lon, date);

  let score = 0;
  let reason = "";

  if (profile.nightBand) {
    // Bandes de nuit (160m, 80m) : score élevé quand les deux côtés sont dans l'obscurité
    const nightScore = (s: DayState) => (s === "night" ? 45 : s === "grayline" ? 35 : 5);
    score = nightScore(qthState) + nightScore(targetState);
    if (qthState === "grayline" || targetState === "grayline") score += 8;
    if (qthState === "day" && targetState === "day") score = 5;
    // Distance limitée la nuit sur les bandes basses
    if (distance > profile.nightMaxKm) score *= 0.3;
    reason = qthState === "night" || qthState === "grayline"
      ? "Nuit/grayline : bande ouverte au DX"
      : "Jour : absorption D, portée très limitée";
  } else if (profile.dayBand) {
    // Bandes de jour (20m, 15m, 10m) : score élevé quand le trajet est éclairé
    const dayScore = (s: DayState) => (s === "day" ? 45 : s === "grayline" ? 30 : 10);
    score = dayScore(qthState) + dayScore(targetState);
    // 20m peut rester ouvert en grayline
    if (band === "20m" && (qthState === "grayline" || targetState === "grayline")) score += 10;
    // 15m et 10m nécessitent du SFI
    if ((band === "15m" || band === "10m") && (solar.sfi == null || solar.sfi < 100)) {
      score *= 0.6;
      reason = "SFI faible : ouverture incertaine";
    }
    if (qthState === "night" && targetState === "night") {
      score = band === "20m" ? 15 : 5; // 20m peut garder un peu la nuit
      reason = "Nuit : bande probablement fermée";
    } else {
      reason = "Jour : bande ouverte au DX mondial";
    }
  } else {
    // 40m : mixte (reprend la logique existante simplifiée)
    const stateScore = (s: DayState) => (s === "night" ? 45 : s === "grayline" ? 40 : 8);
    score = stateScore(qthState) + stateScore(targetState);
    if (qthState === "grayline" || targetState === "grayline") score += 8;
    if (qthState === "day" && targetState === "day" && distance > 2500) score -= 25;
    // Mais le 40m de jour permet du run EU (zones proches)
    if (qthState === "day" && distance < 2500) {
      score = 60; // Run EU toujours bon
      reason = "Jour : run EU zone proche";
    } else {
      reason = qthState === "night" || qthState === "grayline"
        ? "Nuit/grayline : DX ouvert"
        : "Jour : absorption D, DX limité";
    }
  }

  // Effet géomagnétique (Kp)
  const kp = solar.kp;
  if (kp != null && kp >= 3) {
    // Latitude max du trajet (approximation rapide)
    const midLat = Math.abs((qth.lat + zone.lat) / 2);
    const penalty = profile.kpSensitivity * (kp - 2) * (midLat > 55 ? 12 : midLat > 45 ? 6 : 2);
    score -= penalty;
  }

  // Bonus SFI pour les bandes hautes
  if (solar.sfi != null && solar.sfi > 100) {
    score += profile.sfiBonus * ((solar.sfi - 100) / 10);
  }

  // Choix SP vs LP
  let path: "SP" | "LP" = "SP";
  if (distance > 13000) {
    path = "LP";
  } else if ((qthState === "grayline" || targetState === "grayline") && distance > 9000) {
    path = "LP";
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, path, reason };
}

/**
 * Construit la timeline horaire pour une bande spécifique (24 créneaux).
 */
export function buildBandTimeline(
  band: ContestBand,
  solar: SolarInputs,
  startHourUTC: number = 0,
  qth: QthCoords = DEFAULT_QTH
): BandTimelineSlot[] {
  const slots: BandTimelineSlot[] = [];
  const now = new Date();
  const baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

  for (let h = 0; h < 24; h++) {
    const hourUTC = (startHourUTC + h) % 24;
    const date = new Date(baseDate.getTime() + hourUTC * 3600_000);

    const zoneScores = ZONES.map((zone) => {
      const { score, path } = evaluateZoneBand(zone, date, band, solar, qth);
      const { bearing } = bearingDistance(qth.lat, qth.lon, zone.lat, zone.lon);
      const az = path === "LP" ? Math.round((bearing + 180) % 360) : Math.round(bearing);
      return {
        label: zone.label,
        az,
        cardinal: azToCardinal(az),
        path,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    const topZones = zoneScores.slice(0, 4);
    const bandScore = topZones.length > 0 ? Math.round(topZones.reduce((s, z) => s + z.score, 0) / topZones.length) : 0;

    // Génération du headline
    const top = topZones[0];
    let headline: string;
    if (!top || top.score < 15) {
      headline = "Bande fermée";
    } else if (band === "40m" || band === "80m" || band === "160m") {
      const qthState = dayState(qth.lat, qth.lon, date);
      if (qthState === "day") {
        headline = top.score >= 50 ? "Run EU zone proche" : "Portée limitée (jour)";
      } else if (qthState === "grayline") {
        headline = `Grayline → ${top.label.split("(")[0].trim()}`;
      } else {
        headline = `DX nuit → ${top.label.split("(")[0].trim()}`;
      }
    } else {
      // Bandes hautes
      const qthState = dayState(qth.lat, qth.lon, date);
      if (qthState === "night") {
        headline = "Bande fermée (nuit)";
      } else {
        headline = `DX → ${top.label.split("(")[0].trim()}`;
      }
    }

    slots.push({ hourUTC, band, zones: topZones, headline, bandScore });
  }

  return slots;
}

/**
 * Construit la timeline générale (toutes bandes) pour 24h.
 * Pour chaque heure, indique la meilleure bande et un résumé.
 */
export function buildGeneralTimeline(solar: SolarInputs, startHourUTC: number = 0, qth: QthCoords = DEFAULT_QTH): GeneralTimelineSlot[] {
  const allBandTimelines = ALL_CONTEST_BANDS.map((band) => ({
    band,
    slots: buildBandTimeline(band, solar, startHourUTC, qth),
  }));

  const slots: GeneralTimelineSlot[] = [];

  for (let h = 0; h < 24; h++) {
    const hourUTC = (startHourUTC + h) % 24;

    const bands = allBandTimelines.map(({ band, slots: bandSlots }) => {
      const slot = bandSlots[h];
      const topZone = slot.zones[0];
      return {
        band,
        score: slot.bandScore,
        headline: slot.headline,
        topZone: topZone?.label.split("(")[0].trim() ?? "",
        topAz: topZone?.az ?? 0,
        topPath: topZone?.path ?? ("SP" as const),
      };
    }).sort((a, b) => b.score - a.score);

    const best = bands[0];
    const headline = `${best.band.toUpperCase()} → ${best.headline}`;

    slots.push({ hourUTC, bestBand: best.band, bands, headline });
  }

  return slots;
}

/**
 * Retourne le slot courant et les N suivants pour le bandeau défilant.
 * Format optimisé pour le ticker : "13h → Run EU cap 90-120° (40m)"
 */
export function getTickerSlots(
  band: ContestBand | "general",
  solar: SolarInputs,
  count: number = 6,
  qth: QthCoords = DEFAULT_QTH
): { hourUTC: number; text: string; isNow: boolean }[] {
  const nowHour = new Date().getUTCHours();

  if (band === "general") {
    const timeline = buildGeneralTimeline(solar, nowHour, qth);
    return timeline.slice(0, count).map((slot, i) => {
      const best = slot.bands[0];
      const second = slot.bands[1];
      let text = `${String(slot.hourUTC).padStart(2, "0")}h → ${best.band} ${best.headline}`;
      if (best.topAz > 0) text += ` cap ${best.topAz}° ${best.topPath}`;
      if (second && second.score > 30) text += ` | ${second.band} ${second.topZone}`;
      return { hourUTC: slot.hourUTC, text, isNow: i === 0 };
    });
  }

  const timeline = buildBandTimeline(band, solar, nowHour, qth);
  return timeline.slice(0, count).map((slot, i) => {
    const top = slot.zones[0];
    let text = `${String(slot.hourUTC).padStart(2, "0")}h → ${slot.headline}`;
    if (top && top.az > 0 && top.score >= 20) {
      text += ` cap ${top.az}° ${top.cardinal} ${top.path}`;
    }
    return { hourUTC: slot.hourUTC, text, isNow: i === 0 };
  });
}
