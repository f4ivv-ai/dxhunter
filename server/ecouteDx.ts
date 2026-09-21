import sdrDb from "../shared/websdr-db.json";
import { PRIMARY_KIWI } from "../shared/primaryKiwi";
import { qrzLookup } from "./qrz";
import { buildTuneUrl, locatorToLatLon, type SdrEntry } from "./websdr";
import { getUserDeleted, getUserFavorites } from "./websdrSmart";

const SPOTHOLE = "https://spothole.app/api/v1";
const HISTORY_SECONDS = 6 * 60 * 60;
const DEFAULT_QTH = { lat: 45.27, lon: 5.29, locator: "JN25PG" };
const CORRIDOR_HALF_ANGLE = 30;

export type DxPath = "SP" | "LP";

export interface RawEcouteSpot {
  id?: string | number;
  dx_call?: string | null;
  dx_country?: string | null;
  dx_flag?: string | null;
  de_call?: string | null;
  de_country?: string | null;
  mode?: string | null;
  mode_type?: string | null;
  freq?: number | null;
  band?: string | null;
  comment?: string | null;
  source?: string | null;
  received_time?: number | null;
  time?: number | null;
}

export interface EcouteDxCandidate {
  id: string;
  callsign: string;
  country: string | null;
  flag: string | null;
  spotter: string;
  spotterCountry: string | null;
  freqKhz: number;
  mode: string;
  band: string | null;
  comment: string | null;
  source: string;
  spottedAt: number;
  deltaKhz: number;
  qrzUrl: string;
}

export interface RankedReceiver {
  name: string;
  url: string;
  tuneUrl: string;
  city: string;
  country: string;
  type: string;
  lat: number;
  lon: number;
  distanceKm: number;
  bearingFromQth: number;
  offsetDeg: number;
  score: number;
  scoreDetails: {
    alignment: number;
    distance: number;
    accessibility: number;
    favorite: number;
    priority: number;
  };
  isFavorite: boolean;
  isPriority: boolean;
  embeddable: boolean;
  accessLabel: "HTTPS" | "Proxy Kiwi" | "Ouverture externe";
}

type CachedSpots = { expiresAt: number; spots: RawEcouteSpot[] };
const spotCache = new Map<string, CachedSpots>();
let primaryKiwiStatusCache: { expiresAt: number; value: PrimaryKiwiStatus } | null = null;

export interface PrimaryKiwiStatus {
  name: string;
  callsign: string;
  address: string;
  url: string;
  city: string;
  locator: string;
  online: boolean;
  publicAccess: boolean;
  ready: boolean;
  users: number | null;
  usersMax: number | null;
  advertisedName: string | null;
  advertisedGrid: string | null;
  advertisedGps: string | null;
  checkedAt: number;
  warning: string | null;
}

export function parseKiwiStatus(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

/** État public du Kiwi de référence, mis en cache une minute. */
export async function getPrimaryKiwiStatus(): Promise<PrimaryKiwiStatus> {
  if (primaryKiwiStatusCache && primaryKiwiStatusCache.expiresAt > Date.now()) {
    return primaryKiwiStatusCache.value;
  }

  let raw: Record<string, string> = {};
  let online = false;
  const warnings: string[] = [];
  try {
    const response = await fetch(new URL("status", PRIMARY_KIWI.url), {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = parseKiwiStatus(await response.text());
    online = raw.offline !== "yes";
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Kiwi inaccessible");
  }

  const publicAccess = raw.status === "public" && raw.auth !== "password";
  if (online && !publicAccess) {
    warnings.push("Le Kiwi répond, mais son accès public est encore protégé ou privé.");
  }
  const identityMatches = Boolean(raw.name && /F4IVV|Marcilloles/i.test(raw.name));
  if (online && raw.name && !identityMatches) {
    warnings.push(`Nom public à corriger : « ${raw.name} ».`);
  }
  const gpsMatch = raw.gps?.match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
  let locationMatches = false;
  if (gpsMatch) {
    const gpsDistance = bearingDistance(
      PRIMARY_KIWI.lat,
      PRIMARY_KIWI.lon,
      Number(gpsMatch[1]),
      Number(gpsMatch[2]),
    ).distanceKm;
    locationMatches = gpsDistance <= 10;
    if (!locationMatches) {
      warnings.push(`Position GPS publique à corriger (${Math.round(gpsDistance)} km de Marcilloles).`);
    }
  }
  const ready = online;
  const value: PrimaryKiwiStatus = {
    name: PRIMARY_KIWI.name,
    callsign: PRIMARY_KIWI.callsign,
    address: `${PRIMARY_KIWI.host}:${PRIMARY_KIWI.port}`,
    url: PRIMARY_KIWI.url,
    city: PRIMARY_KIWI.city,
    locator: PRIMARY_KIWI.locator,
    online,
    publicAccess,
    ready,
    users: Number.isFinite(Number(raw.users)) ? Number(raw.users) : null,
    usersMax: Number.isFinite(Number(raw.users_max)) ? Number(raw.users_max) : null,
    advertisedName: raw.name || null,
    advertisedGrid: raw.grid || null,
    advertisedGps: raw.gps || null,
    checkedAt: Date.now(),
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  };
  primaryKiwiStatusCache = { expiresAt: Date.now() + 60_000, value };
  return value;
}

export function modeToleranceKhz(mode?: string | null): number {
  const normalized = (mode ?? "SSB").toUpperCase();
  if (normalized.includes("CW")) return 0.5;
  if (/FT8|FT4|RTTY|DIGI|DATA|PSK|JT65|JT9|WSPR/.test(normalized)) return 0.1;
  return 2.5;
}

export function frequencyMatches(
  spotFreqKhz: number,
  targetFreqKhz: number,
  mode?: string | null,
): boolean {
  return Math.abs(spotFreqKhz - targetFreqKhz) <= modeToleranceKhz(mode) + 1e-6;
}

export function frequencyToBand(freqKhz: number): string | null {
  if (freqKhz >= 1800 && freqKhz <= 2000) return "160m";
  if (freqKhz >= 3500 && freqKhz <= 4000) return "80m";
  if (freqKhz >= 5351 && freqKhz <= 5367) return "60m";
  if (freqKhz >= 7000 && freqKhz <= 7300) return "40m";
  if (freqKhz >= 10100 && freqKhz <= 10150) return "30m";
  if (freqKhz >= 14000 && freqKhz <= 14350) return "20m";
  if (freqKhz >= 18068 && freqKhz <= 18168) return "17m";
  if (freqKhz >= 21000 && freqKhz <= 21450) return "15m";
  if (freqKhz >= 24890 && freqKhz <= 24990) return "12m";
  if (freqKhz >= 28000 && freqKhz <= 29700) return "10m";
  if (freqKhz >= 50000 && freqKhz <= 54000) return "6m";
  return null;
}

function getSpotFreqKhz(spot: RawEcouteSpot): number {
  const freq = Number(spot.freq ?? 0);
  return freq > 1_000_000 ? freq / 1000 : freq;
}

export function rankSpotCandidates(
  spots: RawEcouteSpot[],
  targetFreqKhz: number,
  mode?: string | null,
  launchedAt = Date.now(),
): EcouteDxCandidate[] {
  const cutoffSeconds = Math.floor((launchedAt - HISTORY_SECONDS * 1000) / 1000);
  const seenIds = new Set<string>();

  return spots
    .map((spot, index) => {
      const freqKhz = getSpotFreqKhz(spot);
      const spottedAtSeconds = Number(spot.received_time ?? spot.time ?? 0);
      const id = String(spot.id ?? `${spot.dx_call}-${spot.de_call}-${spottedAtSeconds}-${index}`);
      return { spot, freqKhz, spottedAtSeconds, id };
    })
    .filter(({ spot, freqKhz, spottedAtSeconds, id }) => {
      if (!spot.dx_call || !spot.de_call || spottedAtSeconds < cutoffSeconds) return false;
      if (!frequencyMatches(freqKhz, targetFreqKhz, mode)) return false;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .sort((a, b) =>
      b.spottedAtSeconds - a.spottedAtSeconds ||
      String(a.spot.de_call).localeCompare(String(b.spot.de_call)) ||
      String(a.spot.dx_country ?? "").localeCompare(String(b.spot.dx_country ?? "")) ||
      String(a.spot.dx_call).localeCompare(String(b.spot.dx_call)),
    )
    .map(({ spot, freqKhz, spottedAtSeconds, id }) => ({
      id,
      callsign: String(spot.dx_call).toUpperCase(),
      country: spot.dx_country ?? null,
      flag: spot.dx_flag ?? null,
      spotter: String(spot.de_call).toUpperCase(),
      spotterCountry: spot.de_country ?? null,
      freqKhz,
      mode: String(spot.mode ?? spot.mode_type ?? "INCONNU").toUpperCase(),
      band: spot.band ?? frequencyToBand(freqKhz),
      comment: spot.comment ?? null,
      source: String(spot.source ?? "Cluster"),
      spottedAt: spottedAtSeconds * 1000,
      deltaKhz: Math.round((freqKhz - targetFreqKhz) * 100) / 100,
      qrzUrl: `https://www.qrz.com/db/${encodeURIComponent(String(spot.dx_call).toUpperCase())}`,
    }));
}

async function fetchSpotsForBand(band: string | null): Promise<RawEcouteSpot[]> {
  const key = band ?? "all";
  const cached = spotCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.spots;

  const url = new URL(`${SPOTHOLE}/spots`);
  if (band) url.searchParams.set("band", band);
  url.searchParams.set("source", "Cluster,RBN");
  url.searchParams.set("max_age", String(HISTORY_SECONDS));
  url.searchParams.set("limit", "500");
  url.searchParams.set("de_continent", "EU,AF");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Spothole HTTP ${response.status}`);
  const data = await response.json();
  const spots = Array.isArray(data) ? data as RawEcouteSpot[] : [];
  spotCache.set(key, { expiresAt: Date.now() + 12_000, spots });
  return spots;
}

export async function findSpotCandidates(
  targetFreqKhz: number,
  mode?: string | null,
  launchedAt = Date.now(),
): Promise<EcouteDxCandidate[]> {
  const spots = await fetchSpotsForBand(frequencyToBand(targetFreqKhz));
  return rankSpotCandidates(spots, targetFreqKhz, mode, launchedAt);
}

const toRad = (degrees: number) => degrees * Math.PI / 180;
const toDeg = (radians: number) => radians * 180 / Math.PI;

export function bearingDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): { bearing: number; distanceKm: number } {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const dLat = p2 - p1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const distanceKm = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  return { bearing, distanceKm };
}

export function angleDifference(center: number, value: number): number {
  return ((value - center + 540) % 360) - 180;
}

export async function rankCorridorReceivers(params: {
  freqKhz: number;
  mode?: string;
  azimuth: number;
  path: DxPath;
  visitorId: string;
  qthLat?: number;
  qthLon?: number;
  limit?: number;
}): Promise<{ corridorBearing: number; receivers: RankedReceiver[] }> {
  const qthLat = params.qthLat ?? DEFAULT_QTH.lat;
  const qthLon = params.qthLon ?? DEFAULT_QTH.lon;
  const corridorBearing = params.path === "LP" ? (params.azimuth + 180) % 360 : params.azimuth;
  const [favoriteNames, deletedNames] = await Promise.all([
    getUserFavorites(params.visitorId),
    getUserDeleted(params.visitorId),
  ]);
  const favorites = new Set(favoriteNames);
  const deleted = new Set(deletedNames);
  const seen = new Set<string>();

  const receivers = (sdrDb as SdrEntry[])
    .filter((sdr) => {
      if (seen.has(sdr.name) || deleted.has(sdr.name)) return false;
      seen.add(sdr.name);
      return true;
    })
    .map((sdr) => {
      const { bearing, distanceKm } = bearingDistance(qthLat, qthLon, sdr.lat, sdr.lon);
      const offsetDeg = angleDifference(corridorBearing, bearing);
      const absOffset = Math.abs(offsetDeg);
      const alignment = Math.max(0, 45 * (1 - absOffset / CORRIDOR_HALF_ANGLE));
      const distance = Math.min(30, (distanceKm / 6000) * 30);
      const isHttps = sdr.url.startsWith("https://");
      const isKiwiProxy = sdr.url.includes(".proxy.kiwisdr.com");
      const accessibility = isHttps ? 15 : isKiwiProxy ? 11 : 6;
      const favorite = favorites.has(sdr.name) ? 10 : 0;
      const priority = sdr.priority === true ? 100 : 0;
      const score = sdr.priority === true
        ? 100
        : Math.round(alignment + distance + accessibility + favorite);
      return {
        ...sdr,
        distanceKm: Math.round(distanceKm),
        bearingFromQth: Math.round(bearing),
        offsetDeg: Math.round(offsetDeg),
        score,
        scoreDetails: {
          alignment: Math.round(alignment),
          distance: Math.round(distance),
          accessibility,
          favorite,
          priority,
        },
        isFavorite: favorites.has(sdr.name),
        isPriority: sdr.priority === true,
        tuneUrl: buildTuneUrl(sdr.url, sdr.type, params.freqKhz, params.mode),
        embeddable: isHttps,
        accessLabel: (isHttps ? "HTTPS" : isKiwiProxy ? "Proxy Kiwi" : "Ouverture externe") as RankedReceiver["accessLabel"],
      };
    })
    .filter((sdr) => sdr.isPriority || Math.abs(sdr.offsetDeg) <= CORRIDOR_HALF_ANGLE)
    .sort((a, b) =>
      Number(b.isPriority) - Number(a.isPriority) ||
      b.score - a.score ||
      Math.abs(a.offsetDeg) - Math.abs(b.offsetDeg),
    )
    .slice(0, params.limit ?? 12)
    .map((sdr) => ({
      name: sdr.name,
      url: sdr.url,
      tuneUrl: sdr.tuneUrl,
      city: sdr.city,
      country: sdr.country,
      type: sdr.type,
      lat: sdr.lat,
      lon: sdr.lon,
      distanceKm: sdr.distanceKm,
      bearingFromQth: sdr.bearingFromQth,
      offsetDeg: sdr.offsetDeg,
      score: sdr.score,
      scoreDetails: sdr.scoreDetails,
      isFavorite: sdr.isFavorite,
      isPriority: sdr.isPriority,
      embeddable: sdr.embeddable,
      accessLabel: sdr.accessLabel,
    }));

  return { corridorBearing: Math.round(corridorBearing), receivers };
}

export function resolveQth(locator?: string | null): { lat: number; lon: number; locator: string } {
  const normalized = locator?.trim().toUpperCase();
  const position = normalized ? locatorToLatLon(normalized) : null;
  return position ? { ...position, locator: normalized! } : DEFAULT_QTH;
}

export async function lookupCallsign(callsign: string, qthLocator?: string | null) {
  const normalized = callsign.trim().toUpperCase();
  const qrz = await qrzLookup(normalized);
  const qth = resolveQth(qthLocator);
  let geometry: { distanceKm: number; shortPathAzimuth: number; longPathAzimuth: number } | null = null;

  let dxLat = qrz?.lat ?? null;
  let dxLon = qrz?.lon ?? null;
  if ((dxLat == null || dxLon == null) && qrz?.grid) {
    const gridPosition = locatorToLatLon(qrz.grid);
    if (gridPosition) {
      dxLat = gridPosition.lat;
      dxLon = gridPosition.lon;
    }
  }

  if (dxLat != null && dxLon != null) {
    const calculated = bearingDistance(qth.lat, qth.lon, dxLat, dxLon);
    geometry = {
      distanceKm: Math.round(calculated.distanceKm),
      shortPathAzimuth: Math.round(calculated.bearing),
      longPathAzimuth: Math.round((calculated.bearing + 180) % 360),
    };
  }

  return {
    callsign: normalized,
    qrz,
    geometry,
    sources: {
      qrz: `https://www.qrz.com/db/${encodeURIComponent(normalized)}`,
      hamqth: `https://www.hamqth.com/${encodeURIComponent(normalized)}`,
      dxheat: `https://dxheat.com/dxc/${encodeURIComponent(normalized)}`,
    },
    qth,
  };
}
