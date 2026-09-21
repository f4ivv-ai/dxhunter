/**
 * WebSDR Smart Selection — Algorithme intelligent de sélection des WebSDR.
 *
 * Critères de classement :
 *   1. Favoris de l'utilisateur dans la bonne direction → priorité absolue
 *   2. Proximité au DX (ou au corridor de propagation)
 *   3. Couverture de bande (si connue)
 *
 * Les SDR supprimés (table websdr_deleted) sont exclus de toutes les suggestions.
 */

import sdrDb from "../shared/websdr-db.json";
import { buildTuneUrl, type SdrEntry, locatorToLatLon, callToLocator } from "./websdr";
import { getDb } from "./db";
import { websdrFavorites, websdrDeleted } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmartSdr {
  name: string;
  url: string;
  tuneUrl: string;
  distanceKm: number;
  city: string;
  country: string;
  lat: number;
  lon: number;
  type: string;
  isFavorite: boolean;
}

export interface SmartSelectionResult {
  sdrs: SmartSdr[];
  totalAvailable: number;
}

// ─── Geo helpers ────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

export async function getUserFavorites(visitorId: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(websdrFavorites).where(eq(websdrFavorites.visitorId, visitorId));
    return rows.map(r => r.sdrName);
  } catch {
    return [];
  }
}

export async function getUserDeleted(visitorId: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(websdrDeleted).where(eq(websdrDeleted.visitorId, visitorId));
    return rows.map(r => r.sdrName);
  } catch {
    return [];
  }
}

export async function addFavorite(visitorId: string, sdrName: string, sdrUrl: string, lat?: number, lon?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(websdrFavorites).values({
      visitorId,
      sdrName,
      sdrUrl,
      lat: lat ?? null,
      lon: lon ?? null,
    }).onDuplicateKeyUpdate({ set: { sdrUrl } });
    return true;
  } catch (e) {
    console.error("[WebSDR] addFavorite error:", e);
    return false;
  }
}

export async function removeFavorite(visitorId: string, sdrName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.delete(websdrFavorites).where(
      and(eq(websdrFavorites.visitorId, visitorId), eq(websdrFavorites.sdrName, sdrName))
    );
    return true;
  } catch (e) {
    console.error("[WebSDR] removeFavorite error:", e);
    return false;
  }
}

export async function addDeleted(visitorId: string, sdrName: string, sdrUrl: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    // Also remove from favorites if present
    await db.delete(websdrFavorites).where(
      and(eq(websdrFavorites.visitorId, visitorId), eq(websdrFavorites.sdrName, sdrName))
    );
    await db.insert(websdrDeleted).values({
      visitorId,
      sdrName,
      sdrUrl,
    }).onDuplicateKeyUpdate({ set: { sdrUrl } });
    return true;
  } catch (e) {
    console.error("[WebSDR] addDeleted error:", e);
    return false;
  }
}

export async function removeDeleted(visitorId: string, sdrName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.delete(websdrDeleted).where(
      and(eq(websdrDeleted.visitorId, visitorId), eq(websdrDeleted.sdrName, sdrName))
    );
    return true;
  } catch (e) {
    console.error("[WebSDR] removeDeleted error:", e);
    return false;
  }
}

export async function listFavorites(visitorId: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(websdrFavorites).where(eq(websdrFavorites.visitorId, visitorId));
  } catch {
    return [];
  }
}

export async function listDeleted(visitorId: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(websdrDeleted).where(eq(websdrDeleted.visitorId, visitorId));
  } catch {
    return [];
  }
}

// ─── Smart selection: nearby DX ─────────────────────────────────────────────

/**
 * Find the best WebSDR receivers near a DX station, with favorites prioritized
 * and deleted ones excluded.
 */
export async function findBestSdrsForDx(
  dxCall: string,
  freqKhz: number,
  mode: string | undefined,
  dxLat: number | undefined | null,
  dxLon: number | undefined | null,
  visitorId: string | null,
  maxResults = 5,
): Promise<SmartSelectionResult> {
  // Resolve DX position
  let dxPos: { lat: number; lon: number } | null = null;
  if (dxLat != null && dxLon != null && isFinite(dxLat) && isFinite(dxLon)) {
    dxPos = { lat: dxLat, lon: dxLon };
  }
  if (!dxPos) {
    const loc = callToLocator(dxCall);
    if (loc) dxPos = locatorToLatLon(loc);
  }
  if (!dxPos) {
    return { sdrs: [], totalAvailable: 0 };
  }

  // Get user preferences
  const favoriteNames = visitorId ? new Set(await getUserFavorites(visitorId)) : new Set<string>();
  const deletedNames = visitorId ? new Set(await getUserDeleted(visitorId)) : new Set<string>();

  // Calculate distance and filter
  const candidates = (sdrDb as SdrEntry[])
    .filter(sdr => !deletedNames.has(sdr.name))
    .map(sdr => ({
      ...sdr,
      distanceKm: haversineKm(dxPos!.lat, dxPos!.lon, sdr.lat, sdr.lon),
      isFavorite: favoriteNames.has(sdr.name),
    }));

  // Sort: favorites first (by distance), then non-favorites by distance
  candidates.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });

  const totalAvailable = candidates.length;
  const top = candidates.slice(0, maxResults);

  return {
    sdrs: top.map(sdr => ({
      name: sdr.name,
      url: sdr.url,
      tuneUrl: buildTuneUrl(sdr.url, sdr.type, freqKhz, mode),
      distanceKm: Math.round(sdr.distanceKm),
      city: sdr.city,
      country: sdr.country,
      lat: sdr.lat,
      lon: sdr.lon,
      type: sdr.type,
      isFavorite: sdr.isFavorite,
    })),
    totalAvailable,
  };
}

// ─── Smart selection: corridor (Self-Monitor) ───────────────────────────────

const DEFAULT_QTH_LAT = 45.27;
const DEFAULT_QTH_LON = 5.29;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

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

function angleDiff(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

// Island/coastal detection
const ISLAND_COASTAL_COUNTRIES = new Set([
  "CT3", "EA8", "EA9", "CU", "D4", "ZD7", "ZD8", "ZD9", "VP8",
  "PJ2", "PJ4", "PJ5", "PJ6", "PJ7", "FP", "HI", "CO",
  "KH6", "KH2", "KH0", "ZL", "FK", "FO", "VK9", "YB",
  "FR", "3B8", "VQ9", "S7",
  "VP2", "VP5", "V2", "J3", "J6", "J7", "J8", "8P", "FM", "FG",
  "SV5", "SV9", "9H", "IS0", "TK",
  "JA", "HL", "BV", "VR", "9V", "DU", "HS", "9M",
  "IC", "PT", "CY", "MT", "GR", "HR", "JP", "KR", "TW", "HK",
  "SG", "PH", "TH", "MY", "NZ", "AU", "CU", "JM", "BB", "MU",
  "RE", "MQ", "GP", "NC", "PF", "FJ", "GU", "PR", "VI",
  "GB", "IE", "IS", "GL", "BM",
]);

function isIslandCoastal(country: string): boolean {
  return ISLAND_COASTAL_COUNTRIES.has(country) || ISLAND_COASTAL_COUNTRIES.has(country.toUpperCase());
}

export type SdrCategory = "local" | "lointain" | "iles";

export interface SmartCorridorSdr {
  name: string;
  url: string;
  tuneUrl: string;
  distanceKm: number;
  city: string;
  country: string;
  lat: number;
  lon: number;
  flag: string;
  continent: string;
  continentShort: string;
  type: string;
  category: SdrCategory;
  bearingFromQth: number;
  offsetDeg: number;
  isFavorite: boolean;
  isPriority: boolean;
}

export interface SmartCorridorResult {
  corridorBearing: number;
  corridorLabel: string;
  path: "SP" | "LP";
  local: SmartCorridorSdr[];
  lointain: SmartCorridorSdr[];
  iles: SmartCorridorSdr[];
}

import { countryToFlag, getContinent, CONTINENT_SHORT } from "../shared/countryMeta";

const LOCAL_MAX_KM = 500;
const LOCAL_MIN_COUNT = 2; // Always show at least 2 local SDRs
const LOINTAIN_MIN_KM = 6000;
const CORRIDOR_HALF_ANGLE = 30;

/**
 * Find WebSDR receivers along a propagation corridor, with favorites prioritized
 * and deleted ones excluded.
 */
export async function findSmartCorridorSdrs(
  freqKhz: number,
  azimut: number,
  path: "SP" | "LP",
  mode: string | undefined,
  visitorId: string | null,
  qthLat: number = DEFAULT_QTH_LAT,
  qthLon: number = DEFAULT_QTH_LON,
): Promise<SmartCorridorResult> {
  const corridorBearing = path === "LP" ? (azimut + 180) % 360 : azimut;
  const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const corridorLabel = cardinals[Math.round(corridorBearing / 22.5) % 16];

  // Get user preferences
  const favoriteNames = visitorId ? new Set(await getUserFavorites(visitorId)) : new Set<string>();
  const deletedNames = visitorId ? new Set(await getUserDeleted(visitorId)) : new Set<string>();

  const localSdrs: SmartCorridorSdr[] = [];
  const lointainSdrs: SmartCorridorSdr[] = [];
  const ilesSdrs: SmartCorridorSdr[] = [];
  const seenNames = new Set<string>();

  for (const sdr of sdrDb as SdrEntry[]) {
    if (seenNames.has(sdr.name)) continue;
    seenNames.add(sdr.name);

    // Skip deleted SDRs
    if (deletedNames.has(sdr.name)) continue;

    const { bearing, distance } = bearingDistance(qthLat, qthLon, sdr.lat, sdr.lon);
    const offset = angleDiff(corridorBearing, bearing);
    const absOffset = Math.abs(offset);

    const continent = getContinent(sdr.country);
    const entry: SmartCorridorSdr = {
      name: sdr.name,
      url: sdr.url,
      tuneUrl: buildTuneUrl(sdr.url, sdr.type, freqKhz, mode),
      distanceKm: Math.round(distance),
      city: sdr.city,
      country: sdr.country,
      lat: sdr.lat,
      lon: sdr.lon,
      flag: countryToFlag(sdr.country),
      continent,
      continentShort: CONTINENT_SHORT[continent],
      type: sdr.type,
      category: "local",
      bearingFromQth: Math.round(bearing),
      offsetDeg: Math.round(offset),
      isFavorite: favoriteNames.has(sdr.name),
      isPriority: sdr.priority === true,
    };

    // Category 1: LOCAL (0–500 km, any direction)
    if (distance <= LOCAL_MAX_KM) {
      entry.category = "local";
      localSdrs.push(entry);
      continue;
    }

    // Non-local: only within ±30° of corridor
    if (absOffset > CORRIDOR_HALF_ANGLE) continue;

    // Category 3: ILES/CÔTES
    if (isIslandCoastal(sdr.country)) {
      entry.category = "iles";
      ilesSdrs.push(entry);
      continue;
    }

    // Category 2: LOINTAIN (6000+ km)
    if (distance >= LOINTAIN_MIN_KM) {
      entry.category = "lointain";
      lointainSdrs.push(entry);
    }
  }

  // If we have fewer than LOCAL_MIN_COUNT local SDRs, pull the closest ones
  // from all non-deleted SDRs regardless of distance
  if (localSdrs.length < LOCAL_MIN_COUNT) {
    const allByDistance = (sdrDb as SdrEntry[])
      .filter(sdr => !deletedNames.has(sdr.name) && !seenNames.has(sdr.name + "_local_fallback"))
      .map(sdr => {
        const { bearing, distance } = bearingDistance(qthLat, qthLon, sdr.lat, sdr.lon);
        const offset = angleDiff(corridorBearing, bearing);
        const continent = getContinent(sdr.country);
        return {
          entry: {
            name: sdr.name,
            url: sdr.url,
            tuneUrl: buildTuneUrl(sdr.url, sdr.type, freqKhz, mode),
            distanceKm: Math.round(distance),
            city: sdr.city,
            country: sdr.country,
            lat: sdr.lat,
            lon: sdr.lon,
            flag: countryToFlag(sdr.country),
            continent,
            continentShort: CONTINENT_SHORT[continent],
            type: sdr.type,
            category: "local" as SdrCategory,
            bearingFromQth: Math.round(bearing),
            offsetDeg: Math.round(offset),
            isFavorite: favoriteNames.has(sdr.name),
            isPriority: sdr.priority === true,
          },
          distance,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    const localNames = new Set(localSdrs.map(s => s.name));
    for (const { entry } of allByDistance) {
      if (localSdrs.length >= LOCAL_MIN_COUNT) break;
      if (localNames.has(entry.name)) continue;
      localSdrs.push(entry);
      localNames.add(entry.name);
    }
  }

  // Le Kiwi local de référence reste en tête, puis favoris et distance.
  const smartSort = (arr: SmartCorridorSdr[]) => {
    arr.sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });
  };

  smartSort(localSdrs);
  smartSort(lointainSdrs);
  smartSort(ilesSdrs);

  return {
    corridorBearing: Math.round(corridorBearing),
    corridorLabel,
    path,
    local: localSdrs.slice(0, 8),
    lointain: lointainSdrs.slice(0, 10),
    iles: ilesSdrs.slice(0, 10),
  };
}
