/**
 * DX Hunter — Types et logique métier des spots DX.
 * Source de données : API Spothole (https://spothole.app/api/v1).
 */

export interface RawSpot {
  id: string;
  dx_call: string;
  dx_name: string | null;
  dx_qth: string | null;
  dx_country: string | null;
  dx_flag: string | null;
  dx_continent: string | null;
  dx_dxcc_id: number | null;
  dx_cq_zone: number | null;
  dx_latitude: number | null;
  dx_longitude: number | null;
  dx_location_good: boolean;
  de_call: string;
  de_country: string | null;
  de_continent: string | null;
  de_latitude: number | null;
  de_longitude: number | null;
  mode: string | null;
  mode_type: string | null; // CW | PHONE | DATA
  freq: number; // en Hz
  band: string | null;
  comment: string | null;
  qrt: boolean;
  time: number; // epoch s
  time_iso: string;
  received_time: number;
  source: string; // Cluster | RBN | ...
}

export type ModeFamily = "SSB" | "CW" | "FT8" | "DIGI" | "AUTRE";

export interface Spot extends RawSpot {
  freqKhz: number;
  family: ModeFamily;
  isRare: boolean;
  isTarget: boolean;
}

/** Bandes HF suivies par l'application (ordre par fréquence). */
export const TRACKED_BANDS = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
export type TrackedBand = (typeof TRACKED_BANDS)[number];

/** Bandes WARC (pas de contest, mais utiles pour le DX). */
export const WARC_BANDS = ["60m", "30m", "17m", "12m"] as const;
export type WarcBand = (typeof WARC_BANDS)[number];

/** Bandes VHF/UHF surveillées pour la propagation anormale. */
export const VHF_BANDS = ["6m", "4m", "2m", "70cm"] as const;
export type VhfBand = (typeof VHF_BANDS)[number];

/** Toutes les bandes (HF + WARC + VHF/UHF) pour le filtrage avancé. */
export const ALL_BANDS = [...TRACKED_BANDS, ...WARC_BANDS, ...VHF_BANDS] as const;
export type AllBand = (typeof ALL_BANDS)[number];

/** Couleur associée à chaque bande (style "band map" radio). */
export const BAND_COLORS: Record<string, string> = {
  "160m": "#b07aff",  // violet clair — très distinct
  "80m": "#4da6ff",   // bleu vif
  "60m": "#6366f1",   // indigo — WARC 60m
  "40m": "#00d4d4",   // cyan (pas vert)
  "20m": "#f5c842",   // jaune doré (remplace vert)
  "15m": "#ff9f1a",   // orange vif
  "10m": "#ff5577",   // rose-rouge (pas rouge pur)
  "30m": "#8b5cf6",   // violet — WARC
  "17m": "#06b6d4",   // cyan — WARC
  "12m": "#f97316",   // orange — WARC
  "6m": "#ff44ff",    // magenta — Magic Band
  "4m": "#44ffcc",    // turquoise
  "2m": "#44ff44",    // vert vif
  "70cm": "#ffff44",  // jaune vif
};

/**
 * Entités DXCC considérées comme "rares" / recherchées (DX lointains).
 * Liste pragmatique de préfixes d'entités souvent chassées par les DXeurs.
 */
const RARE_PREFIXES = [
  "3Y", "BV9", "BS7", "CE0X", "CE0Y", "CE0Z", "D6", "E3", "E5", "FT5", "FT/",
  "FK", "FO0", "FR", "FT", "H40", "HK0", "JD1", "KH1", "KH3", "KH4", "KH5",
  "KH7K", "KH8", "KH9", "KP1", "KP5", "P5", "PY0", "S0", "SV/A", "T31", "T33",
  "TJ", "TL", "TN", "TT", "TY", "TZ", "VK0", "VK9", "VP6", "VP8", "VU4", "VU7",
  "XR0", "XW", "XX9", "XZ", "YV0", "Z2", "ZD7", "ZD8", "ZD9", "ZK3", "ZL9",
  "ZS8", "9M0", "9U", "9X", "1A", "1S", "7O", "7P", "7Q", "A5",
];

export function isRareEntity(call: string | null): boolean {
  if (!call) return false;
  const c = call.toUpperCase();
  return RARE_PREFIXES.some((p) => c.startsWith(p));
}

/** Fréquences FT8/FT4 standard par bande (kHz). */
const DIGI_FREQ_RANGES: [number, number][] = [
  [1840, 1844],   // 160m FT8
  [3573, 3575],   // 80m FT8
  [7074, 7078],   // 40m FT8/FT4
  [10136, 10140], // 30m FT8
  [14074, 14078], // 20m FT8/FT4
  [18100, 18105], // 17m FT8
  [21074, 21078], // 15m FT8/FT4
  [24915, 24920], // 12m FT8
  [28074, 28078], // 10m FT8/FT4
  [50313, 50318], // 6m FT8
];

/** Modes FT8/FT4 (famille séparée pour filtrage). */
const FT8_MODES = new Set(["FT8", "FT4"]);

/** Autres modes digitaux (hors FT8/FT4). */
const DIGI_MODES = new Set([
  "JT65", "JT9", "WSPR", "JS8", "MSK144",
  "RTTY", "PSK31", "PSK63", "OLIVIA", "SSTV", "MFSK",
  "THOR", "CONTESTIA", "DOMINO", "HELL", "ROS", "VARA",
]);

/** Classe un spot dans une famille de mode lisible. */
export function classifyMode(raw: RawSpot): ModeFamily {
  const m = (raw.mode || "").toUpperCase();
  const t = (raw.mode_type || "").toUpperCase();

  // 1. FT8/FT4 par nom de mode
  if (FT8_MODES.has(m)) return "FT8";

  // 2. Autres modes digitaux par nom
  if (DIGI_MODES.has(m)) return "DIGI";

  // 3. Détection FT8 par fréquence (spots souvent étiquetés USB/SSB par les clusters)
  const freqKhz = raw.freq / 1000;
  for (const [lo, hi] of DIGI_FREQ_RANGES) {
    if (freqKhz >= lo && freqKhz <= hi) return "FT8";
  }

  // 4. mode_type DATA (autres digitaux non identifiés par nom)
  if (t === "DATA") return "DIGI";

  // 5. SSB classique
  if (m === "SSB" || m === "USB" || m === "LSB" || (t === "PHONE" && m !== "AM" && m !== "FM")) {
    return "SSB";
  }
  if (m === "AM" || m === "FM") return "AUTRE";
  if (t === "CW" || m === "CW") return "CW";
  return "AUTRE";
}

export function toSpot(raw: RawSpot, targets: string[] = []): Spot {
  return {
    ...raw,
    freqKhz: raw.freq / 1000,
    family: classifyMode(raw),
    isRare: isRareEntity(raw.dx_call),
    isTarget: matchesTarget(raw.dx_call, raw.dx_country, targets),
  };
}

/**
 * Indique si un spot correspond à une cible définie par l'utilisateur.
 * Une cible peut être un préfixe/indicatif (ex "9M0", "P5", "FT5GA") ou
 * un fragment de nom de pays (ex "Spratly"). Comparaison insensible à la casse.
 */
export function matchesTarget(
  call: string | null,
  country: string | null,
  targets: string[]
): boolean {
  if (!targets.length) return false;
  const c = (call || "").toUpperCase();
  const ctry = (country || "").toUpperCase();
  return targets.some((t) => {
    const q = t.trim().toUpperCase();
    if (!q) return false;
    // match par préfixe d'indicatif OU fragment de pays
    return c.startsWith(q) || (ctry.length > 0 && ctry.includes(q));
  });
}

/** Parse une saisie libre de cibles (séparées par virgule, espace ou retour ligne). */
export function parseTargets(input: string): string[] {
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/** Formate une fréquence en kHz avec décimale (ex : 14195.0). */
export function fmtFreq(khz: number): string {
  return khz.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Ancienneté lisible d'un spot. */
export function ageLabel(epochS: number): string {
  const diff = Math.max(0, Date.now() / 1000 - epochS);
  if (diff < 60) return `${Math.floor(diff)} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  return `${Math.floor(diff / 3600)} h`;
}

/**
 * Corrige l'affichage du mode SSB selon la fréquence :
 * < 10 MHz (160m, 80m, 40m) = LSB, >= 10 MHz (20m, 15m, 10m) = USB.
 * Les modes non-SSB (CW, FT8, DIGI, AM, FM) sont retournés tels quels.
 */
export function displayMode(mode: string | null | undefined, freqKhz: number): string {
  const m = (mode || "").toUpperCase();
  if (!m || m === "SSB" || m === "USB" || m === "LSB") {
    return freqKhz < 10000 ? "LSB" : "USB";
  }
  return m;
}

/** Heure UTC HH:MM:SSZ. */
export function utcClock(d = new Date()): string {
  return (
    d.toISOString().slice(11, 19) + "Z"
  );
}
