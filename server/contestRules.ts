/**
 * Contest Rules Engine — détecte les multiplicateurs selon le concours actif.
 *
 * Concours supportés : CQWW_SSB, CQWPX_SSB, ARRL_DX, REF_SSB
 * Catégories : MULTI_ONE, SINGLE_OP (High Power)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContestDef {
  id: string;
  name: string;
  bands: string[];
  /** Modes autorisés dans ce concours */
  modes: string[];
  /** Types de multiplicateurs pour ce concours */
  multiTypes: string[];
  /** Extrait les multiplicateurs potentiels d'un QSO/spot */
  extractMultipliers: (info: SpotInfo) => MultiplierCandidate[];
}

export interface SpotInfo {
  call: string;
  band: string;
  mode?: string;
  countryPrefix?: string;
  cqZone?: number;
  wpxPrefix?: string;
  continent?: string;
  exchange?: string;
  /** Département FR (pour REF) */
  department?: string;
  /** State US ou province VE (pour ARRL DX) */
  state?: string;
  /** Référence IOTA (ex: EU-005, AF-032) */
  iotaRef?: string;
  /** Commentaire du spot (pour extraction IOTA) */
  comment?: string;
}

export interface MultiplierCandidate {
  type: string; // "zone", "dxcc", "prefix", "dept", "state", "iota"
  value: string;
  band: string;
  mode?: string;
}

export type SpotStatus = "multi" | "done" | "todo";

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Extrait le préfixe WPX d'un indicatif.
 * Règles WPX : le préfixe est la partie lettres+chiffres jusqu'au dernier chiffre inclus.
 * Ex: F4IVV → F4, DL1ABC → DL1, W1AW → W1, VE3EJ → VE3, 9A1A → 9A1
 */
export function extractWpxPrefix(call: string): string {
  if (!call) return "";
  // Nettoyer les suffixes /P /M /QRP etc.
  const clean = call.split("/")[0].toUpperCase();
  // Trouver le dernier chiffre dans l'indicatif
  let lastDigitIdx = -1;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (clean[i] >= "0" && clean[i] <= "9") {
      lastDigitIdx = i;
      break;
    }
  }
  if (lastDigitIdx === -1) return clean.slice(0, 2); // fallback
  return clean.slice(0, lastDigitIdx + 1);
}

/**
 * Extrait le préfixe DXCC approximatif d'un indicatif.
 * Simplifié : prend les lettres avant le premier chiffre.
 */
export function extractCountryPrefix(call: string): string {
  if (!call) return "";
  const clean = call.split("/")[0].toUpperCase();
  // Cas spéciaux numériques (3A, 4X, 5B, 9A, etc.)
  if (clean.length >= 2 && clean[0] >= "0" && clean[0] <= "9") {
    // Préfixe commence par un chiffre : prendre chiffre + lettre(s) avant le call area
    const match = clean.match(/^(\d[A-Z]+)\d/);
    if (match) return match[1];
    return clean.slice(0, 2);
  }
  // Cas normal : lettres avant le premier chiffre
  const match = clean.match(/^([A-Z]+)\d/);
  if (match) return match[1];
  return clean.slice(0, 2);
}

/**
 * Détermine la zone CQ approximative à partir du préfixe pays.
 * Table simplifiée pour les préfixes les plus courants.
 */
const PREFIX_TO_CQ_ZONE: Record<string, number> = {
  // Europe
  F: 14, DL: 14, G: 14, I: 15, EA: 14, CT: 14, PA: 14, ON: 14, HB: 14,
  OE: 15, OK: 15, SP: 15, HA: 15, YU: 15, LZ: 15, SV: 20, OH: 18,
  SM: 14, LA: 14, OZ: 14, EI: 14, GM: 14, GW: 14, GI: 14,
  UR: 16, UA: 16, LY: 15, ES: 15, YL: 15, OM: 15, S5: 15,
  "9A": 15, T7: 14, "3A": 14, HV: 15,
  // Amérique du Nord
  W: 3, K: 4, N: 5, AA: 3, AB: 4, VE: 2, VA: 2, VO: 2, VY: 1,
  XE: 6, TI: 7, HP: 7, HR: 7, YS: 7,
  // Amérique du Sud
  LU: 13, PY: 11, CE: 12, CX: 13, HC: 10, OA: 10, YV: 9, HK: 9,
  // Afrique
  ZS: 38, "5Z": 37, "5H": 37, "5N": 35, CN: 33, "7X": 33, SU: 34,
  "3V": 33, "5T": 35, "6W": 35, TU: 35, "9G": 35, EL: 35,
  // Asie
  JA: 25, BV: 24, HL: 25, VU: 22, A4: 21, A6: 21, A7: 21,
  "9K": 21, HZ: 21, "4X": 20, OD: 20, TA: 20,
  // Océanie
  VK: 29, ZL: 32, KH6: 31, FK: 32, FO: 32,
};

export function guessCqZone(prefix: string): number | undefined {
  if (!prefix) return undefined;
  const upper = prefix.toUpperCase();
  // Essayer le préfixe complet d'abord, puis raccourcir
  if (PREFIX_TO_CQ_ZONE[upper]) return PREFIX_TO_CQ_ZONE[upper];
  if (upper.length > 1 && PREFIX_TO_CQ_ZONE[upper.slice(0, 2)]) return PREFIX_TO_CQ_ZONE[upper.slice(0, 2)];
  if (PREFIX_TO_CQ_ZONE[upper[0]]) return PREFIX_TO_CQ_ZONE[upper[0]];
  return undefined;
}

// ─── Définitions des concours ────────────────────────────────────────────────

const CONTEST_BANDS = ["160", "80", "40", "20", "15", "10"];
const REF_BANDS = ["80", "40", "20", "15", "10"];
const IOTA_BANDS = ["80", "40", "20", "15", "10"];

/**
 * Extrait une référence IOTA (format XX-NNN) d'un texte (commentaire, échange).
 * Ex: "IOTA EU-005" → "EU-005", "EU115" → "EU-115"
 */
export function extractIotaRef(text: string): string | null {
  if (!text) return null;
  const upper = text.toUpperCase();
  // Format standard : XX-NNN
  const match = upper.match(/\b(EU|AF|NA|SA|OC|AS|AN)[-\s]?(\d{3})\b/);
  if (match) return `${match[1]}-${match[2]}`;
  return null;
}

export const CONTESTS: Record<string, ContestDef> = {
  CQWW_SSB: {
    id: "CQWW_SSB",
    name: "CQ World Wide DX Contest SSB",
    bands: CONTEST_BANDS,
    modes: ["SSB"],
    multiTypes: ["zone", "dxcc"],
    extractMultipliers: (info) => {
      const mults: MultiplierCandidate[] = [];
      // Zone CQ
      const zone = info.cqZone || guessCqZone(info.countryPrefix || extractCountryPrefix(info.call));
      if (zone) {
        mults.push({ type: "zone", value: String(zone), band: info.band });
      }
      // Pays DXCC
      const country = info.countryPrefix || extractCountryPrefix(info.call);
      if (country) {
        mults.push({ type: "dxcc", value: country, band: info.band });
      }
      return mults;
    },
  },

  CQWPX_SSB: {
    id: "CQWPX_SSB",
    name: "CQ WPX Contest SSB",
    bands: CONTEST_BANDS,
    modes: ["SSB"],
    multiTypes: ["prefix"],
    extractMultipliers: (info) => {
      const prefix = info.wpxPrefix || extractWpxPrefix(info.call);
      if (!prefix) return [];
      return [{ type: "prefix", value: prefix, band: info.band }];
    },
  },

  ARRL_DX: {
    id: "ARRL_DX",
    name: "ARRL DX Contest",
    bands: CONTEST_BANDS,
    modes: ["CW", "SSB"],
    multiTypes: ["state"],
    extractMultipliers: (info) => {
      // Pour les stations DX (F4IVV) : multi = State US ou Province VE
      if (info.state) {
        return [{ type: "state", value: info.state.toUpperCase(), band: info.band }];
      }
      return [];
    },
  },

  REF_SSB: {
    id: "REF_SSB",
    name: "Coupe du REF SSB",
    bands: REF_BANDS,
    modes: ["SSB"],
    multiTypes: ["dept", "dxcc"],
    extractMultipliers: (info) => {
      const mults: MultiplierCandidate[] = [];
      const country = info.countryPrefix || extractCountryPrefix(info.call);
      // Si station F : multi = département
      if (info.department) {
        mults.push({ type: "dept", value: info.department, band: info.band });
      }
      // Pays DXCC (toujours un multi dans le REF)
      if (country) {
        mults.push({ type: "dxcc", value: country, band: info.band });
      }
      return mults;
    },
  },

  IOTA: {
    id: "IOTA",
    name: "RSGB IOTA Contest",
    bands: IOTA_BANDS,
    modes: ["CW", "SSB"],
    multiTypes: ["iota"],
    extractMultipliers: (info) => {
      // Multiplicateur = référence IOTA unique par bande par mode
      // Tenter d'extraire depuis : iotaRef explicite, exchange, ou commentaire
      const ref = info.iotaRef
        || extractIotaRef(info.exchange || "")
        || extractIotaRef(info.comment || "");
      if (!ref) return [];
      // Pour IOTA, le mult est par bande ET par mode (CW/SSB séparément)
      // On encode le mode dans la clé : "band:iota:EU-005:SSB"
      const mode = (info.mode || "SSB").toUpperCase().includes("CW") ? "CW" : "SSB";
      return [{ type: "iota", value: `${ref}:${mode}`, band: info.band, mode }];
    },
  },
};

// ─── Moteur de coloration ────────────────────────────────────────────────────

export interface WorkedData {
  /** Set de calls travaillés par bande : { "20": Set(["DL1ABC", "W1AW"]), ... } */
  callsByBand: Record<string, Set<string>>;
  /** Set de multiplicateurs travaillés par bande+type : { "20:zone:14": true, "20:dxcc:DL": true } */
  multKeys: Set<string>;
}

/**
 * Détermine le statut d'un spot par rapport au contest actif.
 */
export function getSpotStatus(
  spot: SpotInfo,
  contestId: string,
  worked: WorkedData,
): SpotStatus {
  const contest = CONTESTS[contestId];
  if (!contest) return "todo";

  const band = spot.band;
  const call = spot.call.toUpperCase().split("/")[0];

  // 1. Déjà travaillé sur cette bande ?
  if (worked.callsByBand[band]?.has(call)) {
    return "done";
  }

  // 2. Nouveau multiplicateur ?
  const candidates = contest.extractMultipliers(spot);
  for (const cand of candidates) {
    const key = `${cand.band}:${cand.type}:${cand.value}`;
    if (!worked.multKeys.has(key)) {
      return "multi";
    }
  }

  // 3. Sinon : à faire
  return "todo";
}

/**
 * Liste des concours disponibles (pour le UI).
 */
export function listContests() {
  return Object.values(CONTESTS).map((c) => ({
    id: c.id,
    name: c.name,
    bands: c.bands,
    modes: c.modes,
    multiTypes: c.multiTypes,
  }));
}
