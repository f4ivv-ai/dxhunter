/**
 * Moteur de propagation 40 m pour TM0HQ — QTH de référence JN25PG.
 * Fournit : conversion locator, azimut/distance great-circle (SP & LP),
 * position solaire (jour/nuit, grayline), lever/coucher local, et un
 * modèle heuristique d'ouverture 40 m par zone selon l'heure UTC.
 *
 * Toutes les heures sont en UTC. Le modèle est probabiliste (aide à la
 * décision), il doit être croisé avec les spots réels et l'écoute WebSDR.
 */

/** Locator par défaut (TM0HQ) — utilisé si l'utilisateur n'a pas encore défini le sien. */
export const DEFAULT_QTH_LOCATOR = "JN25PG";
/** @deprecated Utiliser DEFAULT_QTH_LOCATOR ou le locator de l'utilisateur */
export const QTH_LOCATOR = DEFAULT_QTH_LOCATOR;

/** Convertit un locator Maidenhead (4 ou 6 car.) en latitude/longitude (centre de case). */
export function locatorToLatLon(loc: string): { lat: number; lon: number } {
  const L = loc.toUpperCase().padEnd(6, "A");
  let lon = (L.charCodeAt(0) - 65) * 20 - 180;
  let lat = (L.charCodeAt(1) - 65) * 10 - 90;
  lon += parseInt(L[2], 10) * 2;
  lat += parseInt(L[3], 10) * 1;
  lon += (L.charCodeAt(4) - 65) * (2 / 24) + (2 / 24) / 2;
  lat += (L.charCodeAt(5) - 65) * (1 / 24) + (1 / 24) / 2;
  return { lat, lon };
}

export const QTH = locatorToLatLon(QTH_LOCATOR); // ~45.27N, 5.29E

/** Retourne les coordonnées QTH en fonction du locator utilisateur (ou défaut JN25PG). */
export function getUserQTH(userLocator?: string | null): { lat: number; lon: number; locator: string } {
  const loc = userLocator && userLocator.length >= 4 ? userLocator : DEFAULT_QTH_LOCATOR;
  return { ...locatorToLatLon(loc), locator: loc };
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Azimut great-circle (degrés, 0=N) et distance (km) entre deux points. */
export function bearingDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
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

export const longPath = (sp: number) => (sp + 180) % 360;

/** Convertit un azimut en point cardinal court (N, NE, E…). */
export function azToCardinal(az: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  return dirs[Math.round(az / 22.5) % 16];
}

/* ------------------------------------------------------------------ */
/* Position solaire (algorithme NOAA simplifié)                        */
/* ------------------------------------------------------------------ */

/** Renvoie le point subsolaire (lat/lon où le Soleil est au zénith) pour une date. */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const rad = Math.PI / 180;
  const dayMs = 86400000;
  const jd = date.getTime() / dayMs + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const epsilon = 23.439 * rad;
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / rad;
  // équation du temps (minutes) approximée
  const eqTime =
    4 *
    ((L -
      0.0057183 -
      toDeg(Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)))) %
      360);
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let lon = -(utcMin + eqTime - 720) / 4; // longitude où le Soleil est au méridien
  lon = ((lon + 180) % 360) - 180;
  return { lat: decl, lon };
}

/** Élévation solaire (degrés) en un point à une date donnée. */
export function solarElevation(lat: number, lon: number, date: Date): number {
  const sub = subsolarPoint(date);
  const { distance } = bearingDistance(lat, lon, sub.lat, sub.lon);
  const angular = (distance / 6371) * (180 / Math.PI); // distance angulaire au point subsolaire
  return 90 - angular; // élévation = 90 - angle zénithal
}

export type DayState = "day" | "night" | "grayline";

/** Classe l'état d'éclairement d'un point : jour, nuit, ou grayline (crépuscule). */
export function dayState(lat: number, lon: number, date: Date): DayState {
  const el = solarElevation(lat, lon, date);
  if (el > 6) return "day";
  if (el < -12) return "night";
  return "grayline"; // -12° .. +6° : zone crépusculaire élargie (utile DX bandes basses)
}

/* ------------------------------------------------------------------ */
/* Zones cibles pour le contest IARU depuis JN25                       */
/* ------------------------------------------------------------------ */

export interface Zone {
  id: string;
  label: string;
  lat: number;
  lon: number;
  ituNote: string;
}

export const ZONES: Zone[] = [
  { id: "eu_e", label: "Europe Est (UA/UR/SP)", lat: 50.4, lon: 30.5, ituNote: "ITU 28/29" },
  { id: "scand", label: "Scandinavie (OH/SM/LA)", lat: 60.2, lon: 24.9, ituNote: "ITU 18" },
  { id: "me", label: "Moyen-Orient (A4/9K/4X)", lat: 29.4, lon: 47.9, ituNote: "ITU 39/21" },
  { id: "ua9", label: "Russie d'Asie (UA9/0)", lat: 55.0, lon: 82.9, ituNote: "ITU 30/31/32" },
  { id: "us_e", label: "USA Est (W1-W4/VE)", lat: 40.7, lon: -74.0, ituNote: "ITU 8/9" },
  { id: "vu", label: "Inde (VU)", lat: 28.6, lon: 77.2, ituNote: "ITU 41" },
  { id: "carib", label: "Caraïbes (PJ/FY/FG)", lat: 18.0, lon: -66.0, ituNote: "ITU 11" },
  { id: "zs", label: "Afrique du Sud (ZS)", lat: -26.2, lon: 28.0, ituNote: "ITU 57" },
  { id: "py", label: "Brésil (PY)", lat: -23.5, lon: -46.6, ituNote: "ITU 15" },
  { id: "us_w", label: "USA Ouest (W6/W7)", lat: 34.0, lon: -118.2, ituNote: "ITU 6/7" },
  { id: "ja", label: "Japon (JA)", lat: 35.7, lon: 139.7, ituNote: "ITU 45" },
  { id: "sea", label: "Asie SE (9M/HS/YB)", lat: 3.1, lon: 101.7, ituNote: "ITU 49/54" },
  { id: "vk", label: "Australie Est (VK)", lat: -33.9, lon: 151.2, ituNote: "ITU 59" },
  { id: "zl", label: "Nouvelle-Zélande (ZL)", lat: -41.3, lon: 174.8, ituNote: "ITU 60" },
];

export interface ZoneProp {
  zone: Zone;
  spAz: number;
  lpAz: number;
  distance: number;
  /** état d'éclairement au QTH et à la cible */
  qthState: DayState;
  targetState: DayState;
  /** score d'ouverture 0..100 et chemin recommandé */
  score: number;
  path: "SP" | "LP";
  reason: string;
  /** latitude maximale (absolue) traversée par le trajet short path */
  pathMaxLat: number;
  /** vrai si le trajet est sensible à l'activité géomagnétique (hautes latitudes) */
  geoSensitive: boolean;
}

/* ------------------------------------------------------------------ */
/* Météo solaire : interprétation des indices pour le 40 m            */
/* ------------------------------------------------------------------ */

export interface SolarInputs {
  /** Kp planétaire courant (0-9) */
  kp: number | null;
  /** Flux solaire F10.7 / SFI */
  sfi: number | null;
  /** Classe d'éruption en cours (ex. "M2.3", "X1.1", "C5") */
  flareClass: string | null;
  /** Échelle de black-out NOAA dérivée (R0..R5) */
  blackout: string | null;
}

export type GeoLevel = "calme" | "instable" | "actif" | "tempete" | "severe";

export function geoLevel(kp: number | null): GeoLevel {
  if (kp == null) return "calme";
  if (kp <= 2) return "calme";
  if (kp === 3) return "instable";
  if (kp === 4) return "actif";
  if (kp <= 6) return "tempete";
  return "severe";
}

/** Niveau de black-out (R) actif côté jour à cause d'une éruption. */
export function blackoutLevel(blackout: string | null): number {
  if (!blackout) return 0;
  const m = blackout.match(/R(\d)/);
  return m ? Number(m[1]) : 0;
}

/** Synthèse pédagogique de la météo solaire pour le 40 m. */
export interface SolarVerdict {
  geo: GeoLevel;
  headline: string;
  detail: string;
  /** consigne d'azimut : caps à éviter / privilégier */
  steer: string;
  tone: "good" | "warn" | "bad";
}

export function solarVerdict(s: SolarInputs): SolarVerdict {
  const geo = geoLevel(s.kp);
  const rb = blackoutLevel(s.blackout);
  const sfi = s.sfi ?? 0;
  const sfiTxt =
    sfi >= 150 ? "SFI élevé : portée nocturne étendue, DX lointain favorisé" :
    sfi >= 100 ? "SFI correct : bonne portée nocturne" :
    sfi > 0 ? "SFI faible : ouvertures lointaines plus courtes" : "SFI indisponible";

  let headline: string;
  let detail: string;
  let steer: string;
  let tone: "good" | "warn" | "bad";

  if (geo === "calme") {
    headline = "Géomagnétisme calme — tous les caps ouverts";
    detail = `${sfiTxt}. Kp ${s.kp ?? "?"} : chemins nord et polaires exploitables, signaux stables.`;
    steer = "Exploiter le nord (Scandinavie, Russie, JA matin) et la grayline sans restriction.";
    tone = "good";
  } else if (geo === "instable" || geo === "actif") {
    headline = `Géomagnétisme ${geo} — chemins nord à surveiller`;
    detail = `${sfiTxt}. Kp ${s.kp ?? "?"} : flutter/QSB possibles sur les trajets de haute latitude.`;
    steer = "Garder le run vers l'Europe ; pour les mults, viser est/ouest à latitude moyenne et sud.";
    tone = "warn";
  } else {
    headline = `Tempête géomagnétique (Kp ${s.kp ?? "?"}) — caps nord fermés`;
    detail = `${sfiTxt}. Absorption auroral : JA/Asie centrale nord et Scandinavie très dégradés.`;
    steer = "Basculer la chasse vers le SUD et le transéquatorial (Afrique, Amérique du Sud), long path par le sud.";
    tone = "bad";
  }

  if (rb >= 1) {
    headline = `Éruption ${s.flareClass} — black-out radio ${s.blackout} côté jour`;
    detail = `Absorption couche D côté soleil (effet bref). De nuit, aucun impact sur le 40 m. ${detail}`;
    steer = `Côté jour : creux HF ~10-60 min, se reporter sur les zones côté nuit/grayline. ${steer}`;
    tone = rb >= 3 ? "bad" : "warn";
  }

  return { geo, headline, detail, steer, tone };
}

/**
 * Heuristique d'ouverture 40 m : un trajet est favorable lorsque le QTH
 * et/ou la cible sont dans l'obscurité ou en grayline (faible absorption D),
 * et idéalement quand les deux extrémités sont sur le terminateur (pic grayline).
 * Bonus distance pour le long path sur trajets > ~13000 km (Pacifique).
 */
/** Latitude (absolue) maximale traversée par le grand cercle QTH->cible (échantillonné). */
function pathMaxLatitude(lat2: number, lon2: number, qth: { lat: number; lon: number } = QTH): number {
  const steps = 24;
  const p1 = toRad(qth.lat);
  const l1 = toRad(qth.lon);
  const p2 = toRad(lat2);
  const l2 = toRad(lon2);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((p2 - p1) / 2) ** 2 +
          Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2
      )
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

export function evaluateZone(
  zone: Zone,
  date: Date,
  solar: SolarInputs | number | null,
  qth: { lat: number; lon: number } = QTH
): ZoneProp {
  // rétro-compatibilité : un nombre = Kp seul
  const sin: SolarInputs =
    typeof solar === "number" || solar === null
      ? { kp: typeof solar === "number" ? solar : null, sfi: null, flareClass: null, blackout: null }
      : solar;

  const { bearing: spAz, distance } = bearingDistance(qth.lat, qth.lon, zone.lat, zone.lon);
  const lpAz = longPath(spAz);
  const qthState = dayState(qth.lat, qth.lon, date);
  const targetState = dayState(zone.lat, zone.lon, date);
  const pathMaxLat = pathMaxLatitude(zone.lat, zone.lon, qth);

  // score de base selon l'éclairement (40m = bande de nuit)
  const stateScore = (s: DayState) => (s === "night" ? 45 : s === "grayline" ? 40 : 8);
  let score = stateScore(qthState) + stateScore(targetState); // max ~90

  // bonus grayline si une extrémité au moins est en crépuscule
  if (qthState === "grayline" || targetState === "grayline") score += 8;
  if (qthState === "grayline" && targetState === "grayline") score += 10;

  // pénalité forte de jour des deux côtés (sauf zones proches)
  if (qthState === "day" && targetState === "day" && distance > 2500) score -= 25;

  // --- Effet géomagnétique selon la latitude du trajet ---
  // plus le trajet monte en latitude, plus il est sensible au Kp
  const geoSensitive = pathMaxLat >= 55;
  const kp = sin.kp;
  if (kp != null && kp >= 3) {
    if (pathMaxLat >= 60) score -= (kp - 2) * 9; // transpolaire/auroral
    else if (pathMaxLat >= 50) score -= (kp - 2) * 5; // haute latitude
    else if (pathMaxLat >= 40) score -= (kp - 2) * 2; // latitude moyenne
    // trajets sud (lat basse) : quasi insensibles
  }

  // --- Effet SFI : bonus de portée nocturne pour le DX lointain ---
  if (sin.sfi != null) {
    if (distance > 8000) {
      if (sin.sfi >= 150) score += 8;
      else if (sin.sfi >= 110) score += 4;
      else if (sin.sfi < 80) score -= 6;
    }
  }

  // --- Effet éruption / black-out : seulement côté jour ---
  const rb = blackoutLevel(sin.blackout);
  if (rb >= 1 && (qthState === "day" || targetState === "day")) {
    score -= rb * 8; // R1~-8 .. R3~-24
  }

  // choix SP vs LP
  let path: "SP" | "LP" = "SP";
  let reason = "";
  if (distance > 13000) {
    path = "LP";
    reason = "Distance antipodale : tester le long path en grayline";
  } else if ((qthState === "grayline" || targetState === "grayline") && distance > 9000) {
    path = "LP";
    reason = "Grayline + longue distance : le long path peut surpasser le short path";
  } else if (geoSensitive && kp != null && kp >= 5) {
    reason = "Trajet haute latitude perturbé (Kp élevé) : préférer une cible plus au sud";
  } else {
    reason = qthState === "day" && distance > 2500 ? "Absorption diurne : ouverture limitée" : "Short path direct";
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { zone, spAz, lpAz, distance, qthState, targetState, score, path, reason, pathMaxLat, geoSensitive };
}

/** Évalue toutes les zones et les trie par score décroissant. */
export function evaluateAllZones(date: Date, solar: SolarInputs | number | null, qth: { lat: number; lon: number } = QTH): ZoneProp[] {
  return ZONES.map((z) => evaluateZone(z, date, solar, qth)).sort((a, b) => b.score - a.score);
}

/** Calcule lever/coucher du Soleil (UTC) au QTH pour la date donnée (approx.). */
export function sunTimesQTH(date: Date, qth: { lat: number; lon: number } = QTH): { sunrise: Date | null; sunset: Date | null } {
  // balayage minute par minute sur 24h : transitions d'élévation autour de 0°
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  let prev = solarElevation(qth.lat, qth.lon, base);
  for (let m = 1; m <= 24 * 60; m++) {
    const d = new Date(base.getTime() + m * 60000);
    const el = solarElevation(qth.lat, qth.lon, d);
    if (prev < 0 && el >= 0 && !sunrise) sunrise = d;
    if (prev >= 0 && el < 0 && !sunset) sunset = d;
    prev = el;
  }
  return { sunrise, sunset };
}
