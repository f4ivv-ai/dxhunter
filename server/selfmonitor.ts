/**
 * Self-Monitor module — Finds WebSDR receivers along a propagation corridor.
 *
 * Three categories:
 *   - "local"    : 0–500 km from QTH — verify modulation / signal output
 *   - "lointain" : 6 000+ km along the corridor (±30°) — verify signal arrival
 *   - "iles"     : island / coastal SDRs within ±30° of the corridor — strategic relay points
 *
 * SP = short path (direct bearing), LP = long path (bearing + 180°).
 */

import sdrDb from "../shared/websdr-db.json";
import { buildTuneUrl, type SdrEntry } from "./websdr";
import { countryToFlag, getContinent, CONTINENT_SHORT, type Continent } from "../shared/countryMeta";

// ─── QTH par défaut : JN25PG — utilisé si utilisateur sans locator ───────────
const DEFAULT_QTH_LAT = 45.27;
const DEFAULT_QTH_LON = 5.29;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// ─── Geo helpers ────────────────────────────────────────────────────────────

/** Azimut great-circle (degrés, 0=N) et distance (km) entre deux points. */
function bearingDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): { bearing: number; distance: number } {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const a =
    Math.sin((p2 - p1) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  return { bearing, distance };
}

/** Différence angulaire signée entre deux azimuts (-180 à +180). */
function angleDiff(a: number, b: number): number {
  let d = ((b - a + 540) % 360) - 180;
  return d;
}

// ─── Island / coastal detection ─────────────────────────────────────────────
const ISLAND_COASTAL_COUNTRIES = new Set([
  // Atlantic islands
  "CT3", "EA8", "EA9", "CU", "D4", "ZD7", "ZD8", "ZD9", "VP8",
  "PJ2", "PJ4", "PJ5", "PJ6", "PJ7", "FP", "HI", "CO",
  // Pacific islands
  "KH6", "KH2", "KH0", "ZL", "FK", "FO", "VK9", "YB",
  // Indian Ocean
  "FR", "3B8", "VQ9", "S7",
  // Caribbean
  "VP2", "VP5", "V2", "J3", "J6", "J7", "J8", "8P", "FM", "FG",
  // Mediterranean islands
  "SV5", "SV9", "9H", "IS0", "TK",
  // Other coastal/island
  "JA", "HL", "BV", "VR", "9V", "DU", "HS", "9M",
  // Country codes (2-letter ISO used in our DB)
  "IC", "PT", "CY", "MT", "GR", "HR", "JP", "KR", "TW", "HK",
  "SG", "PH", "TH", "MY", "NZ", "AU", "CU", "JM", "BB", "MU",
  "RE", "MQ", "GP", "NC", "PF", "FJ", "GU", "PR", "VI",
  "GB", "IE", "IS", "GL", "BM",
]);

function isIslandCoastal(country: string): boolean {
  return ISLAND_COASTAL_COUNTRIES.has(country) || ISLAND_COASTAL_COUNTRIES.has(country.toUpperCase());
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type SdrCategory = "local" | "lointain" | "iles";

export interface SelfMonitorSdr {
  name: string;
  tuneUrl: string;
  distanceKm: number;
  city: string;
  country: string;
  flag: string;
  continent: Continent;
  continentShort: string;
  type: string;
  category: SdrCategory;
  bearingFromQth: number;
  /** Angle offset from corridor center */
  offsetDeg: number;
  isPriority: boolean;
}

export interface SelfMonitorResult {
  corridorBearing: number;
  corridorLabel: string;
  path: "SP" | "LP";
  local: SelfMonitorSdr[];
  lointain: SelfMonitorSdr[];
  iles: SelfMonitorSdr[];
}

// ─── Thresholds ─────────────────────────────────────────────────────────────
const LOCAL_MAX_KM = 500;
const LOINTAIN_MIN_KM = 6000;
const CORRIDOR_HALF_ANGLE = 30; // ±30° from corridor center

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Find WebSDR receivers along a propagation corridor from QTH.
 * @param freqKhz - Frequency in kHz (for tune URL generation)
 * @param azimut - Antenna bearing in degrees (0-360)
 * @param path - "SP" (short path) or "LP" (long path)
 * @param mode - Optional mode (SSB, CW, etc.)
 */
export function findCorridorSdrs(
  freqKhz: number,
  azimut: number,
  path: "SP" | "LP",
  mode?: string,
  qthLat: number = DEFAULT_QTH_LAT,
  qthLon: number = DEFAULT_QTH_LON,
): SelfMonitorResult {
  // If LP, the actual propagation direction is the opposite
  const corridorBearing = path === "LP" ? (azimut + 180) % 360 : azimut;

  // Cardinal label
  const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const corridorLabel = cardinals[Math.round(corridorBearing / 22.5) % 16];

  const localSdrs: SelfMonitorSdr[] = [];
  const lointainSdrs: SelfMonitorSdr[] = [];
  const ilesSdrs: SelfMonitorSdr[] = [];
  const seenNames = new Set<string>();

  for (const sdr of sdrDb as SdrEntry[]) {
    // Dédoublonnage par nom (la base peut contenir des entrées dupliquées)
    if (seenNames.has(sdr.name)) continue;
    seenNames.add(sdr.name);
    const { bearing, distance } = bearingDistance(qthLat, qthLon, sdr.lat, sdr.lon);
    const offset = angleDiff(corridorBearing, bearing);
    const absOffset = Math.abs(offset);

    const continent = getContinent(sdr.country);
    const entry: SelfMonitorSdr = {
      name: sdr.name,
      tuneUrl: buildTuneUrl(sdr.url, sdr.type, freqKhz, mode),
      distanceKm: Math.round(distance),
      city: sdr.city,
      country: sdr.country,
      flag: countryToFlag(sdr.country),
      continent,
      continentShort: CONTINENT_SHORT[continent],
      type: sdr.type,
      category: "local", // will be set below
      bearingFromQth: Math.round(bearing),
      offsetDeg: Math.round(offset),
      isPriority: sdr.priority === true,
    };

    // ── Category 1: LOCAL (0–500 km, any direction) ──
    if (distance <= LOCAL_MAX_KM) {
      entry.category = "local";
      localSdrs.push(entry);
      continue;
    }

    // For non-local SDRs, only consider those within ±30° of corridor
    if (absOffset > CORRIDOR_HALF_ANGLE) continue;

    // ── Category 3: ILES/CÔTES (island/coastal within ±30°, any distance > 500km) ──
    if (isIslandCoastal(sdr.country)) {
      entry.category = "iles";
      ilesSdrs.push(entry);
      continue; // île/côte = une seule catégorie, pas de doublon
    }

    // ── Category 2: LOINTAIN (6000+ km, within ±30° of corridor, non-île) ──
    if (distance >= LOINTAIN_MIN_KM) {
      entry.category = "lointain";
      lointainSdrs.push(entry);
    }
  }

  // Kiwi local de référence en tête, puis classement par distance.
  const priorityThenDistance = (a: SelfMonitorSdr, b: SelfMonitorSdr) =>
    a.isPriority !== b.isPriority
      ? (a.isPriority ? -1 : 1)
      : a.distanceKm - b.distanceKm;
  localSdrs.sort(priorityThenDistance);
  lointainSdrs.sort(priorityThenDistance);
  ilesSdrs.sort(priorityThenDistance);

  return {
    corridorBearing: Math.round(corridorBearing),
    corridorLabel,
    path,
    local: localSdrs.slice(0, 6),
    lointain: lointainSdrs.slice(0, 8),
    iles: ilesSdrs.slice(0, 8),
  };
}
