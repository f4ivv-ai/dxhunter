/**
 * DX Hunter — Détecteur de propagation anormale (Sporadic E, TEP, Tropo, MS, Aurora).
 *
 * Analyse les spots DX en temps réel pour détecter les ouvertures de propagation
 * inhabituelles, principalement sur les bandes VHF/UHF (6m, 4m, 2m, 70cm).
 *
 * Heuristiques :
 * 1. Mots-clés dans les commentaires des spots (Es, TEP, Tropo, MS, Aurora, F2)
 * 2. Fréquence VHF/UHF + distance anormale entre spotter et DX
 * 3. Burst d'activité : augmentation soudaine de spots sur une bande VHF
 *
 * Expose : getOpenings() → liste des ouvertures actives avec type, bande, direction.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PropagationType = "Es" | "TEP" | "Tropo" | "MS" | "Aurora" | "F2" | "Backscatter" | "Unknown";

export interface PropagationOpening {
  id: string;
  type: PropagationType;
  band: string;
  /** Fréquence en kHz du premier spot détecté */
  freqKhz: number;
  /** Direction(s) de l'ouverture (continents ou pays) */
  directions: string[];
  /** Nombre de spots confirmant l'ouverture */
  spotCount: number;
  /** Stations entendues (indicatifs DX) */
  stations: string[];
  /** Stations spotteuses (indicatifs de_call) */
  spotters: string[];
  /** SNR moyen si disponible (FT8) */
  avgSnr: number | null;
  /** Distance max observée en km */
  maxDistanceKm: number;
  /** Timestamp de début de l'ouverture */
  startedAt: number;
  /** Timestamp du dernier spot */
  lastSpotAt: number;
  /** Commentaires bruts des spots (pour info) */
  comments: string[];
  /** Niveau de confiance : high / medium / low */
  confidence: "high" | "medium" | "low";
}

export interface PropagationAlert {
  openings: PropagationOpening[];
  /** Timestamp de la dernière analyse */
  lastAnalysis: number;
}

interface DetectedSpot {
  id: string;
  dxCall: string;
  deCall: string;
  freqKhz: number;
  band: string;
  comment: string;
  dxCountry: string | null;
  dxContinent: string | null;
  deContinent: string | null;
  dxLat: number | null;
  dxLon: number | null;
  deLat: number | null;
  deLon: number | null;
  timestamp: number;
  detectedType: PropagationType;
  distance: number;
  snr: number | null;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Fenêtre d'analyse : 30 minutes */
const ANALYSIS_WINDOW_MS = 30 * 60 * 1000;

/** Seuil de distance (km) pour considérer une propagation anormale par bande */
const DISTANCE_THRESHOLDS: Record<string, number> = {
  "6m": 500,    // 50 MHz : > 500 km = probable Es
  "4m": 400,    // 70 MHz : > 400 km = probable Es
  "2m": 300,    // 144 MHz : > 300 km = propagation anormale
  "70cm": 200,  // 430 MHz : > 200 km = propagation anormale (tropo)
  "10m": 3000,  // 28 MHz : > 3000 km peut indiquer Es (multi-hop) ou F2
};

/** Seuil minimum de spots pour confirmer une ouverture */
const MIN_SPOTS_FOR_OPENING = 2;

/** Bandes VHF/UHF surveillées */
const VHF_BANDS = ["6m", "4m", "2m", "70cm"] as const;

/** Toutes les bandes pouvant montrer de la propagation anormale */
const MONITORED_BANDS = ["10m", "6m", "4m", "2m", "70cm"] as const;

// ─── Regex de détection par mots-clés ──────────────────────────────────────────

const KEYWORD_PATTERNS: { type: PropagationType; regex: RegExp }[] = [
  { type: "Es", regex: /\b(Es|SpE|spor(adic)?[\s-]?[eE]|spo[\s-]?e)\b/i },
  { type: "TEP", regex: /\b(TEP|trans[\s-]?eq(uat(orial)?)?)\b/i },
  { type: "MS", regex: /\b(MS|meteor[\s-]?(scatter)?|MSK144|FSK441)\b/i },
  { type: "Tropo", regex: /\b(tropo(spheric)?|duct(ing)?)\b/i },
  { type: "Aurora", regex: /\b(aurora(l)?)\b/i },
  { type: "F2", regex: /\b(F2[\s-]?(layer)?|long[\s-]?path)\b/i },
  { type: "Backscatter", regex: /\b(back[\s-]?scatter|BS)\b/i },
];

/** Mots-clés explicites dans les commentaires qui indiquent une ouverture sporadique */
const SPORADIC_COMMENT_HINTS = /\b(50\s*mhz|6m|magic\s*band|sporadic|Es\s+open|band\s+open|vhf\s+open)\b/i;

// ─── État interne ──────────────────────────────────────────────────────────────

let detectedSpots: DetectedSpot[] = [];
let lastAnalysis = 0;
let cachedOpenings: PropagationOpening[] = [];

// ─── Fonctions utilitaires ─────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1), dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function extractSnr(comment: string | null): number | null {
  if (!comment) return null;
  // Patterns FT8 : "-12 dB", "SNR -5", "+3dB"
  const m = comment.match(/([+-]?\d{1,2})\s*d[Bb]/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function freqToBand(freqKhz: number): string | null {
  if (freqKhz >= 1800 && freqKhz <= 2000) return "160m";
  if (freqKhz >= 3500 && freqKhz <= 4000) return "80m";
  if (freqKhz >= 5351 && freqKhz <= 5367) return "60m";
  if (freqKhz >= 7000 && freqKhz <= 7300) return "40m";
  if (freqKhz >= 10100 && freqKhz <= 10150) return "30m";
  if (freqKhz >= 14000 && freqKhz <= 14350) return "20m";
  if (freqKhz >= 18068 && freqKhz <= 18168) return "17m";
  if (freqKhz >= 21000 && freqKhz <= 21450) return "15m";
  if (freqKhz >= 24890 && freqKhz <= 24990) return "12m";
  if (freqKhz >= 28000 && freqKhz < 29700) return "10m";
  if (freqKhz >= 50000 && freqKhz < 54000) return "6m";
  if (freqKhz >= 70000 && freqKhz < 70500) return "4m";
  if (freqKhz >= 144000 && freqKhz < 148000) return "2m";
  if (freqKhz >= 430000 && freqKhz < 440000) return "70cm";
  return null;
}

function detectTypeFromComment(comment: string | null): PropagationType | null {
  if (!comment) return null;
  for (const { type, regex } of KEYWORD_PATTERNS) {
    if (regex.test(comment)) return type;
  }
  if (SPORADIC_COMMENT_HINTS.test(comment)) return "Es";
  return null;
}

function detectTypeFromContext(band: string, distance: number, freqKhz: number): PropagationType {
  // VHF avec grande distance = probablement Es
  if ((band === "6m" || band === "4m") && distance > (DISTANCE_THRESHOLDS[band] || 500)) {
    return "Es";
  }
  // 2m avec grande distance : peut être Es (rare), Tropo, ou MS
  if (band === "2m" && distance > 300) {
    if (distance > 1500) return "Es"; // Es double-hop rare sur 2m
    return "Tropo"; // par défaut tropo pour 2m
  }
  // 70cm : toujours tropo si distance anormale
  if (band === "70cm" && distance > 200) {
    return "Tropo";
  }
  // 10m avec distance > 3000 km hors propagation normale
  if (band === "10m" && distance > 3000) {
    return "Es";
  }
  return "Unknown";
}

function generateOpeningId(type: PropagationType, band: string, startedAt: number): string {
  return `${type}-${band}-${Math.floor(startedAt / 60000)}`;
}

// ─── API publique ──────────────────────────────────────────────────────────────

/**
 * Ingère un spot brut et vérifie s'il indique une propagation anormale.
 * Appelé par le routeur spots à chaque nouveau lot de spots.
 */
export function ingestSpot(spot: {
  id: string;
  dx_call: string;
  de_call: string;
  freq: number; // Hz
  band: string | null;
  comment: string | null;
  dx_country: string | null;
  dx_continent: string | null;
  de_continent: string | null;
  dx_latitude: number | null;
  dx_longitude: number | null;
  de_latitude: number | null;
  de_longitude: number | null;
  received_time: number; // epoch seconds
}): void {
  const freqKhz = spot.freq / 1000;
  const band = spot.band || freqToBand(freqKhz);
  if (!band) return;

  // Ne surveiller que les bandes pertinentes
  if (!MONITORED_BANDS.includes(band as any)) return;

  // Calcul de distance si coordonnées disponibles
  let distance = 0;
  if (spot.dx_latitude && spot.dx_longitude && spot.de_latitude && spot.de_longitude) {
    distance = haversine(spot.de_latitude, spot.de_longitude, spot.dx_latitude, spot.dx_longitude);
  }

  // Détection par mot-clé dans le commentaire
  let detectedType = detectTypeFromComment(spot.comment);

  // Si pas de mot-clé, détection par contexte (bande + distance)
  if (!detectedType && distance > 0) {
    const threshold = DISTANCE_THRESHOLDS[band];
    if (threshold && distance > threshold) {
      detectedType = detectTypeFromContext(band, distance, freqKhz);
    }
  }

  // Si toujours rien détecté et que c'est une bande VHF, on garde quand même
  // les spots VHF pour le suivi d'activité (même sans propagation anormale confirmée)
  if (!detectedType && VHF_BANDS.includes(band as any)) {
    // Tout spot VHF est potentiellement intéressant
    detectedType = "Unknown";
  }

  if (!detectedType) return;

  const snr = extractSnr(spot.comment);

  const detected: DetectedSpot = {
    id: spot.id,
    dxCall: spot.dx_call,
    deCall: spot.de_call,
    freqKhz,
    band,
    comment: spot.comment || "",
    dxCountry: spot.dx_country,
    dxContinent: spot.dx_continent,
    deContinent: spot.de_continent,
    dxLat: spot.dx_latitude,
    dxLon: spot.dx_longitude,
    deLat: spot.de_latitude,
    deLon: spot.de_longitude,
    timestamp: spot.received_time * 1000,
    detectedType,
    distance,
    snr,
  };

  detectedSpots.push(detected);

  // Limite mémoire
  if (detectedSpots.length > 5000) {
    detectedSpots = detectedSpots.slice(-2500);
  }
}

/**
 * Analyse les spots détectés et retourne les ouvertures de propagation actives.
 */
export function getOpenings(): PropagationAlert {
  pruneOldSpots();

  // Regrouper par type + bande
  const groups = new Map<string, DetectedSpot[]>();

  for (const s of detectedSpots) {
    if (s.detectedType === "Unknown") continue; // exclure les "Unknown" des alertes
    const key = `${s.detectedType}|${s.band}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const openings: PropagationOpening[] = [];

  for (const [key, spots] of groups) {
    if (spots.length < MIN_SPOTS_FOR_OPENING) continue;

    const [type, band] = key.split("|") as [PropagationType, string];
    const sorted = spots.sort((a, b) => a.timestamp - b.timestamp);
    const startedAt = sorted[0].timestamp;
    const lastSpotAt = sorted[sorted.length - 1].timestamp;

    // Directions uniques (continents DX)
    const directions = [...new Set(spots.map(s => s.dxContinent).filter(Boolean))] as string[];
    // Stations DX uniques
    const stations = [...new Set(spots.map(s => s.dxCall))].slice(0, 20);
    // Spotters uniques
    const spotters = [...new Set(spots.map(s => s.deCall))].slice(0, 10);
    // Commentaires (derniers 5)
    const comments = spots
      .filter(s => s.comment)
      .map(s => s.comment)
      .slice(-5);
    // SNR moyen
    const snrs = spots.map(s => s.snr).filter((s): s is number => s !== null);
    const avgSnr = snrs.length > 0 ? Math.round(snrs.reduce((a, b) => a + b, 0) / snrs.length) : null;
    // Distance max
    const maxDistanceKm = Math.max(...spots.map(s => s.distance));
    // Fréquence du premier spot
    const freqKhz = sorted[0].freqKhz;

    // Confiance
    let confidence: "high" | "medium" | "low" = "low";
    if (spots.length >= 5 && spots.some(s => detectTypeFromComment(s.comment) !== null)) {
      confidence = "high";
    } else if (spots.length >= 3 || spots.some(s => detectTypeFromComment(s.comment) !== null)) {
      confidence = "medium";
    }

    openings.push({
      id: generateOpeningId(type, band, startedAt),
      type,
      band,
      freqKhz,
      directions,
      spotCount: spots.length,
      stations,
      spotters,
      avgSnr,
      maxDistanceKm,
      startedAt,
      lastSpotAt,
      comments,
      confidence,
    });
  }

  // Trier par nombre de spots décroissant
  openings.sort((a, b) => b.spotCount - a.spotCount);

  cachedOpenings = openings;
  lastAnalysis = Date.now();

  return { openings, lastAnalysis };
}

/**
 * Retourne le résumé d'activité VHF (tous les spots VHF, y compris Unknown).
 */
export function getVhfActivity(): { band: string; count: number; stations: string[] }[] {
  pruneOldSpots();
  const result: { band: string; count: number; stations: string[] }[] = [];

  for (const band of VHF_BANDS) {
    const bandSpots = detectedSpots.filter(s => s.band === band);
    if (bandSpots.length === 0) continue;
    const stations = [...new Set(bandSpots.map(s => s.dxCall))].slice(0, 15);
    result.push({ band, count: bandSpots.length, stations });
  }

  return result;
}

/**
 * Vérifie rapidement s'il y a des ouvertures actives (pour le polling léger).
 */
export function hasActiveOpenings(): boolean {
  return cachedOpenings.length > 0;
}

// ─── Nettoyage ─────────────────────────────────────────────────────────────────

function pruneOldSpots() {
  const cutoff = Date.now() - ANALYSIS_WINDOW_MS;
  detectedSpots = detectedSpots.filter(s => s.timestamp > cutoff);
}

// ─── Initialisation ────────────────────────────────────────────────────────────

let pruneInterval: ReturnType<typeof setInterval> | null = null;

export function initPropagationDetector() {
  pruneInterval = setInterval(pruneOldSpots, 60_000);
  console.log("[PropagationDetector] Initialisé — surveillance Es/TEP/Tropo/MS/Aurora");
}

export function shutdownPropagationDetector() {
  if (pruneInterval) clearInterval(pruneInterval);
}

// ─── Exports pour tests ────────────────────────────────────────────────────────

export function _testReset() {
  detectedSpots = [];
  cachedOpenings = [];
  lastAnalysis = 0;
}

export { detectTypeFromComment, detectTypeFromContext, freqToBand, extractSnr, KEYWORD_PATTERNS };
