/**
 * Logique de calibration multi-bandes côté serveur (autonome — ne dépend pas du client).
 *
 * Objectif : pour un instant donné, calculer pour chaque zone cible ET chaque bande
 * le score d'ouverture PRÉDIT par le modèle, puis le comparer à l'activité RÉELLE
 * (nombre de spots vers cette zone sur cette bande) afin de mesurer l'écart et
 * d'entraîner le pilote J-12 → J-0.
 *
 * Supporte les 6 bandes contest : 160m, 80m, 40m, 20m, 15m, 10m.
 */

const DEFAULT_QTH = { lat: 45.27, lon: 5.29 }; // JN25PG (fallback)

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export type ContestBand = "160m" | "80m" | "40m" | "20m" | "15m" | "10m";
export const ALL_CONTEST_BANDS: ContestBand[] = ["160m", "80m", "40m", "20m", "15m", "10m"];

export interface CalibZone {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

/** Zones cibles : mêmes que le client (identifiants alignés). */
export const CALIB_ZONES: CalibZone[] = [
  { id: "eu_e", label: "Europe Est (UA/UR/SP)", lat: 50.4, lon: 30.5 },
  { id: "scand", label: "Scandinavie (OH/SM/LA)", lat: 60.2, lon: 24.9 },
  { id: "me", label: "Moyen-Orient (A4/9K/4X)", lat: 29.4, lon: 47.9 },
  { id: "ua9", label: "Russie d'Asie (UA9/0)", lat: 55.0, lon: 82.9 },
  { id: "us_e", label: "USA Est (W1-W4/VE)", lat: 40.7, lon: -74.0 },
  { id: "vu", label: "Inde (VU)", lat: 28.6, lon: 77.2 },
  { id: "carib", label: "Caraïbes (PJ/FY/FG)", lat: 18.0, lon: -66.0 },
  { id: "zs", label: "Afrique du Sud (ZS)", lat: -26.2, lon: 28.0 },
  { id: "py", label: "Brésil (PY)", lat: -23.5, lon: -46.6 },
  { id: "us_w", label: "USA Ouest (W6/W7)", lat: 34.0, lon: -118.2 },
  { id: "ja", label: "Japon (JA)", lat: 35.7, lon: 139.7 },
  { id: "sea", label: "Asie SE (9M/HS/YB)", lat: 3.1, lon: 101.7 },
  { id: "vk", label: "Australie Est (VK)", lat: -33.9, lon: 151.2 },
  { id: "zl", label: "Nouvelle-Zélande (ZL)", lat: -41.3, lon: 174.8 },
];

function bearingDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const a =
    Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  return { distance };
}

function subsolarPoint(date: Date): { lat: number; lon: number } {
  const rad = Math.PI / 180;
  const dayMs = 86400000;
  const jd = date.getTime() / dayMs + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const epsilon = 23.439 * rad;
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / rad;
  const eqTime =
    4 *
    ((L - 0.0057183 - toDeg(Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)))) %
      360);
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let lon = -(utcMin + eqTime - 720) / 4;
  lon = ((lon + 180) % 360) - 180;
  return { lat: decl, lon };
}

function solarElevation(lat: number, lon: number, date: Date): number {
  const sub = subsolarPoint(date);
  const { distance } = bearingDistance(lat, lon, sub.lat, sub.lon);
  const angular = (distance / 6371) * (180 / Math.PI);
  return 90 - angular;
}

export type DayState = "day" | "night" | "grayline";

function dayState(lat: number, lon: number, date: Date): DayState {
  const el = solarElevation(lat, lon, date);
  if (el > 6) return "day";
  if (el < -12) return "night";
  return "grayline";
}

function pathMaxLatitude(lat2: number, lon2: number, qth: { lat: number; lon: number } = DEFAULT_QTH): number {
  const steps = 24;
  const p1 = toRad(qth.lat);
  const l1 = toRad(qth.lon);
  const p2 = toRad(lat2);
  const l2 = toRad(lon2);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2,
      ),
    );
  if (d === 0) return Math.abs(lat2);
  let maxLat = Math.max(Math.abs(qth.lat), Math.abs(lat2));
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    if (Math.abs(lat) > maxLat) maxLat = Math.abs(lat);
  }
  return maxLat;
}

export interface SolarInputs {
  kp: number | null;
  sfi: number | null;
  blackout: string | null;
}

function blackoutLevel(blackout: string | null): number {
  if (!blackout) return 0;
  const m = blackout.match(/R(\d)/);
  return m ? Number(m[1]) : 0;
}

/* ------------------------------------------------------------------ */
/* Profils de propagation par bande                                    */
/* ------------------------------------------------------------------ */

interface BandProfile {
  nightBand: boolean;
  dayBand: boolean;
  nightMaxKm: number;
  kpSensitivity: number;
  sfiBonus: number;
}

const BAND_PROFILES: Record<ContestBand, BandProfile> = {
  "160m": { nightBand: true, dayBand: false, nightMaxKm: 12000, kpSensitivity: 0.9, sfiBonus: 0 },
  "80m": { nightBand: true, dayBand: false, nightMaxKm: 15000, kpSensitivity: 0.7, sfiBonus: 0.1 },
  "40m": { nightBand: false, dayBand: false, nightMaxKm: 20000, kpSensitivity: 0.5, sfiBonus: 0.2 },
  "20m": { nightBand: false, dayBand: true, nightMaxKm: 5000, kpSensitivity: 0.3, sfiBonus: 0.5 },
  "15m": { nightBand: false, dayBand: true, nightMaxKm: 2000, kpSensitivity: 0.2, sfiBonus: 0.8 },
  "10m": { nightBand: false, dayBand: true, nightMaxKm: 1000, kpSensitivity: 0.1, sfiBonus: 1.0 },
};

/** Score d'ouverture prédit (0-100) pour une zone et une bande, à une date donnée. */
export function predictScore(zone: CalibZone, date: Date, solar: SolarInputs, band: ContestBand = "40m", qth: { lat: number; lon: number } = DEFAULT_QTH): number {
  const profile = BAND_PROFILES[band];
  const { distance } = bearingDistance(qth.lat, qth.lon, zone.lat, zone.lon);
  const qthState = dayState(qth.lat, qth.lon, date);
  const targetState = dayState(zone.lat, zone.lon, date);
  const pathMaxLat = pathMaxLatitude(zone.lat, zone.lon, qth);

  let score = 0;

  if (profile.nightBand) {
    // Bandes de nuit (160m, 80m)
    const nightScore = (s: DayState) => (s === "night" ? 45 : s === "grayline" ? 35 : 5);
    score = nightScore(qthState) + nightScore(targetState);
    if (qthState === "grayline" || targetState === "grayline") score += 8;
    if (qthState === "day" && targetState === "day") score = 5;
    if (distance > profile.nightMaxKm) score *= 0.3;
  } else if (profile.dayBand) {
    // Bandes de jour (20m, 15m, 10m)
    const dayScore = (s: DayState) => (s === "day" ? 45 : s === "grayline" ? 30 : 10);
    score = dayScore(qthState) + dayScore(targetState);
    if (band === "20m" && (qthState === "grayline" || targetState === "grayline")) score += 10;
    if ((band === "15m" || band === "10m") && (solar.sfi == null || solar.sfi < 100)) {
      score *= 0.6;
    }
    if (qthState === "night" && targetState === "night") {
      score = band === "20m" ? 15 : 5;
    }
  } else {
    // 40m : mixte
    const stateScore = (s: DayState) => (s === "night" ? 45 : s === "grayline" ? 40 : 8);
    score = stateScore(qthState) + stateScore(targetState);
    if (qthState === "grayline" || targetState === "grayline") score += 8;
    if (qthState === "grayline" && targetState === "grayline") score += 10;
    if (qthState === "day" && targetState === "day" && distance > 2500) score -= 25;
  }

  // Effet géomagnétique (Kp)
  const kp = solar.kp;
  if (kp != null && kp >= 3) {
    const penalty = profile.kpSensitivity * (kp - 2) * (pathMaxLat >= 60 ? 9 : pathMaxLat >= 50 ? 5 : pathMaxLat >= 40 ? 2 : 1);
    score -= penalty;
  }

  // Bonus SFI pour les bandes hautes
  if (solar.sfi != null && solar.sfi > 100) {
    score += profile.sfiBonus * ((solar.sfi - 100) / 10);
  }
  if (solar.sfi != null && distance > 8000) {
    if (solar.sfi >= 150) score += 8 * profile.sfiBonus;
    else if (solar.sfi >= 110) score += 4 * profile.sfiBonus;
    else if (solar.sfi < 80) score -= 6 * profile.kpSensitivity;
  }

  // Black-out radio
  const rb = blackoutLevel(solar.blackout);
  if (rb >= 1 && (qthState === "day" || targetState === "day")) score -= rb * 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Spot minimal nécessaire au rattachement zone. */
export interface RawSpot {
  dx_latitude?: number | null;
  dx_longitude?: number | null;
  band?: string | null;
  frequency?: number | null;
}

/** Compte les spots réels par zone, filtrés par bande. */
export function countSpotsByZone(spots: RawSpot[], band?: ContestBand): Map<string, number> {
  const by = new Map<string, number>();
  for (const z of CALIB_ZONES) by.set(z.id, 0);
  for (const s of spots) {
    if (s.dx_latitude == null || s.dx_longitude == null) continue;
    // Filtrer par bande si spécifié
    if (band && s.band !== band) continue;
    let best: string | null = null;
    let bestD = Infinity;
    for (const z of CALIB_ZONES) {
      const d = (z.lat - s.dx_latitude) ** 2 + (z.lon - s.dx_longitude) ** 2;
      if (d < bestD) {
        bestD = d;
        best = z.id;
      }
    }
    if (best && bestD < 900) by.set(best, (by.get(best) || 0) + 1);
  }
  return by;
}

/** Convertit un nombre de spots en "score réel" 0-100 (échelle logarithmique douce). */
export function spotsToScore(n: number): number {
  if (n <= 0) return 0;
  // échelle log douce : 1 spot ~30, 3 ~58, 7 ~86, 15+ ~100
  const score = Math.round(28 * Math.log2(n + 1) + 2);
  return Math.max(0, Math.min(100, score));
}

export interface SnapshotRow {
  snapDate: string;
  hourUtc: number;
  band: ContestBand;
  zoneId: string;
  zoneLabel: string;
  predictedScore: number;
  actualSpots: number;
  actualScore: number;
  error: number;
  kp: number | null;
  sfi: number | null;
  aIndex: number | null;
  source: "auto" | "manual";
}

/**
 * Construit les lignes de snapshot pour l'instant `now` à partir des spots
 * TOUTES BANDES et de la météo solaire courante.
 * Produit une ligne par (bande × zone) = 6 bandes × 14 zones = 84 lignes.
 */
export function buildSnapshot(
  spots: RawSpot[],
  solar: SolarInputs & { aIndex: number | null },
  now: Date,
  source: "auto" | "manual",
): SnapshotRow[] {
  const snapDate = now.toISOString().slice(0, 10);
  const hourUtc = now.getUTCHours();
  const rows: SnapshotRow[] = [];

  for (const band of ALL_CONTEST_BANDS) {
    const counts = countSpotsByZone(spots, band);
    for (const z of CALIB_ZONES) {
      const predictedScore = predictScore(z, now, solar, band);
      const actualSpots = counts.get(z.id) || 0;
      const actualScore = spotsToScore(actualSpots);
      rows.push({
        snapDate,
        hourUtc,
        band,
        zoneId: z.id,
        zoneLabel: z.label,
        predictedScore,
        actualSpots,
        actualScore,
        error: predictedScore - actualScore,
        kp: solar.kp,
        sfi: solar.sfi,
        aIndex: solar.aIndex,
        source,
      });
    }
  }

  return rows;
}

/** Agrège l'erreur absolue moyenne (MAE) et le biais sur un ensemble de lignes. */
export function calibrationAccuracy(rows: { error: number }[]): {
  mae: number;
  bias: number;
  reliability: number;
} {
  if (rows.length === 0) return { mae: 0, bias: 0, reliability: 0 };
  let sumAbs = 0;
  let sum = 0;
  for (const r of rows) {
    sumAbs += Math.abs(r.error);
    sum += r.error;
  }
  const mae = sumAbs / rows.length;
  const bias = sum / rows.length;
  // fiabilité : 100 quand MAE=0, 0 quand MAE>=60
  const reliability = Math.max(0, Math.min(100, Math.round(100 - (mae / 60) * 100)));
  return { mae: Math.round(mae), bias: Math.round(bias), reliability };
}

/* ------------------------------------------------------------------ */
/* Ajustement du modèle basé sur l'historique (apprentissage du biais) */
/* ------------------------------------------------------------------ */

/** Correction apprise pour une zone+bande : décalage moyen à retrancher au score prédit. */
export interface ZoneCorrection {
  zoneId: string;
  band?: ContestBand;
  /** biais moyen observé (predicted - actual) sur l'historique de la zone */
  bias: number;
  /** nombre d'observations ayant servi à l'apprentissage */
  samples: number;
  /** facteur de confiance 0-1 (monte avec le nombre d'échantillons) */
  confidence: number;
}

/**
 * Apprend, par zone (et optionnellement par bande), le biais moyen du modèle
 * à partir de l'historique de snapshots.
 */
export function learnCorrections(
  history: Array<{ zoneId: string; error: number; snapDate: string; band?: string }>,
  today: string = new Date().toISOString().slice(0, 10),
): Map<string, ZoneCorrection> {
  const acc = new Map<string, { wsum: number; w: number; n: number }>();
  const todayMs = Date.parse(today + "T00:00:00Z");
  for (const r of history) {
    const ageDays = Math.max(
      0,
      Math.round((todayMs - Date.parse(r.snapDate + "T00:00:00Z")) / 86400_000),
    );
    // fraîcheur : poids 1.0 aujourd'hui, décroît de moitié environ sur 10 jours
    const weight = Math.exp(-ageDays / 10);
    // Clé composite : band+zoneId si band présent, sinon zoneId seul (rétrocompat)
    const key = r.band ? `${r.band}:${r.zoneId}` : r.zoneId;
    const cur = acc.get(key) ?? { wsum: 0, w: 0, n: 0 };
    cur.wsum += r.error * weight;
    cur.w += weight;
    cur.n += 1;
    acc.set(key, cur);
  }
  const out = new Map<string, ZoneCorrection>();
  for (const [key, v] of Array.from(acc.entries())) {
    const bias = v.w > 0 ? v.wsum / v.w : 0;
    // confiance : sature vers 1 à partir de ~6 échantillons
    const confidence = Math.max(0, Math.min(1, v.n / 6));
    const parts = key.split(":");
    const zoneId = parts.length > 1 ? parts[1] : parts[0];
    const band = parts.length > 1 ? (parts[0] as ContestBand) : undefined;
    out.set(key, { zoneId, band, bias: Math.round(bias), samples: v.n, confidence });
  }
  return out;
}

/**
 * Applique la correction apprise à un score prédit brut.
 */
export function applyCorrection(
  rawScore: number,
  correction: ZoneCorrection | undefined,
): number {
  if (!correction || correction.samples === 0) return rawScore;
  const adjusted = rawScore - correction.bias * correction.confidence;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}
