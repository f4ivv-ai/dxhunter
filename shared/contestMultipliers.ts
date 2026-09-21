/**
 * Multiplicateurs par concours — données de référence et logique d'extraction.
 *
 * Concours supportés :
 *  - CQ WPX : préfixes (toutes bandes confondues)
 *  - CQ WW : zones CQ + pays DXCC, par bande
 *  - IARU HFC : zones ITU + stations HQ IARU, par bande
 *  - Coupe du REF : départements FR + DOM/TOM (+ pays DXCC pour F), par bande
 */

// ---------------------------------------------------------------------------
// Types communs
// ---------------------------------------------------------------------------

export type ContestId = "CQ_WPX" | "CQ_WW" | "IARU_HFC" | "COUPE_REF" | "IOTA";

export interface ContestMeta {
  id: ContestId;
  name: string;
  shortName: string;
  description: string;
  multPerBand: boolean; // true = multiplicateurs comptés par bande
  bands: string[];
}

export const CONTESTS: ContestMeta[] = [
  {
    id: "CQ_WPX",
    name: "CQ WPX",
    shortName: "WPX",
    description: "Préfixes uniques (toutes bandes confondues)",
    multPerBand: false,
    bands: ["160m", "80m", "40m", "20m", "15m", "10m"],
  },
  {
    id: "CQ_WW",
    name: "CQ WW DX",
    shortName: "WW",
    description: "Zones CQ + Pays DXCC, par bande",
    multPerBand: true,
    bands: ["160m", "80m", "40m", "20m", "15m", "10m"],
  },
  {
    id: "IARU_HFC",
    name: "IARU HF Championship",
    shortName: "IARU",
    description: "Zones ITU + Stations HQ IARU, par bande",
    multPerBand: true,
    bands: ["160m", "80m", "40m", "20m", "15m", "10m"],
  },
  {
    id: "COUPE_REF",
    name: "Coupe du REF",
    shortName: "REF",
    description: "Départements FR + DOM/TOM, par bande",
    multPerBand: true,
    bands: ["80m", "40m", "20m", "15m", "10m"],
  },
  {
    id: "IOTA",
    name: "RSGB IOTA Contest",
    shortName: "IOTA",
    description: "Références IOTA par bande et par mode (CW/SSB)",
    multPerBand: true,
    bands: ["80m", "40m", "20m", "15m", "10m"],
  },
];

// ---------------------------------------------------------------------------
// CQ WPX — extraction de préfixe
// ---------------------------------------------------------------------------

/**
 * Extrait le préfixe WPX d'un indicatif.
 * Règles officielles CQ WPX :
 * - Le préfixe = lettres + chiffre(s) formant le début du call
 * - Portable : le désignateur portable devient le préfixe
 * - Pas de chiffre → on ajoute 0 après les 2 premières lettres
 */
export function extractWpxPrefix(call: string): string {
  if (!call) return "";
  let c = call.toUpperCase().trim();

  // Retirer les suffixes non-préfixe (/M, /MM, /A, /E, /J, /P, /QRP)
  c = c.replace(/\/(MM?|A|E|J|P|QRP)$/i, "");

  // Portable : si contient / et pas un suffixe standard, le premier segment est le préfixe
  if (c.includes("/")) {
    const parts = c.split("/");
    // Si le premier segment contient un chiffre, c'est le préfixe portable
    // Sinon, c'est le deuxième segment
    const portable = parts[0];
    const main = parts[1] || "";
    // Si le portable ressemble à un préfixe (lettres + chiffre), l'utiliser
    if (/[0-9]/.test(portable) && portable.length <= 5) {
      return normalizePrefix(portable);
    }
    // Sinon utiliser le préfixe du call principal
    if (/[0-9]/.test(main) && main.length > portable.length) {
      return normalizePrefix(portable.length <= 3 ? portable + "0" : portable);
    }
    return normalizePrefix(parts[0]);
  }

  // Call standard : extraire lettres + premier groupe de chiffres
  const match = c.match(/^([A-Z]{1,3}\d+)/);
  if (match) return match[1];

  // Pas de chiffre : ajouter 0 après les 2 premières lettres
  if (c.length >= 2) return c.slice(0, 2) + "0";
  return c;
}

function normalizePrefix(p: string): string {
  if (/[0-9]/.test(p)) return p;
  // Pas de chiffre → ajouter 0 après les 2 premières lettres
  return p.length >= 2 ? p.slice(0, 2) + "0" : p;
}

// ---------------------------------------------------------------------------
// CQ WW — 40 zones CQ
// ---------------------------------------------------------------------------

export const CQ_ZONES = Array.from({ length: 40 }, (_, i) => i + 1);

/**
 * Approxime la zone CQ à partir de lat/lon.
 * Utilise dx_cq_zone du spot si disponible, sinon estimation géographique.
 */
export function cqZoneFromLatLon(lat: number, lon: number): number | null {
  // Amérique du Nord
  if (lat >= 48 && lon >= -170 && lon < -140) return 1; // Alaska/NW
  if (lat >= 48 && lon >= -140 && lon < -100) return 2; // Canada Ouest
  if (lat >= 48 && lon >= -100 && lon < -70) return 2; // Canada Est
  if (lat >= 25 && lat < 48 && lon >= -130 && lon < -100) return 3; // USA Ouest
  if (lat >= 25 && lat < 48 && lon >= -100 && lon < -80) return 4; // USA Centre
  if (lat >= 25 && lat < 48 && lon >= -80 && lon < -60) return 5; // USA Est
  // Amérique Centrale & Caraïbes
  if (lat >= 7 && lat < 25 && lon >= -120 && lon < -60) return 6; // Mexique/Caraïbes
  if (lat >= 0 && lat < 7 && lon >= -82 && lon < -60) return 7; // Am. Centrale
  // Amérique du Sud
  if (lat >= -10 && lat < 12 && lon >= -82 && lon < -34) return 9; // Nord SA
  if (lat >= -30 && lat < -10 && lon >= -82 && lon < -34) return 11; // Centre SA
  if (lat < -30 && lon >= -82 && lon < -34) return 13; // Sud SA
  // Europe
  if (lat >= 60 && lon >= -10 && lon < 40) return 18; // Scandinavie
  if (lat >= 45 && lat < 60 && lon >= -10 && lon < 20) return 14; // Europe Ouest
  if (lat >= 45 && lat < 60 && lon >= 20 && lon < 40) return 15; // Europe Est
  if (lat >= 35 && lat < 45 && lon >= -10 && lon < 20) return 14; // Sud Europe Ouest
  if (lat >= 35 && lat < 45 && lon >= 20 && lon < 40) return 20; // Méditerranée Est
  // Afrique
  if (lat >= 20 && lat < 35 && lon >= -20 && lon < 40) return 33; // Afrique du Nord
  if (lat >= 0 && lat < 20 && lon >= -20 && lon < 40) return 35; // Afrique Centrale
  if (lat < 0 && lon >= -20 && lon < 55) return 38; // Afrique du Sud
  // Asie
  if (lat >= 45 && lon >= 40 && lon < 75) return 16; // Russie d'Europe/Oural
  if (lat >= 45 && lon >= 75 && lon < 120) return 17; // Sibérie
  if (lat >= 45 && lon >= 120 && lon < 180) return 19; // Extrême-Orient
  if (lat >= 25 && lat < 45 && lon >= 40 && lon < 75) return 21; // Moyen-Orient
  if (lat >= 25 && lat < 45 && lon >= 75 && lon < 100) return 22; // Asie du Sud
  if (lat >= 25 && lat < 45 && lon >= 100 && lon < 150) return 25; // Japon/Chine Est
  if (lat >= 0 && lat < 25 && lon >= 60 && lon < 100) return 22; // Inde
  if (lat >= 0 && lat < 25 && lon >= 100 && lon < 150) return 26; // Asie SE
  // Océanie
  if (lat >= -50 && lat < 0 && lon >= 110 && lon < 160) return 29; // Australie
  if (lat >= -50 && lat < 0 && lon >= 160 && lon < 180) return 32; // Nouvelle-Zélande
  if (lat >= -30 && lat < 0 && lon >= -180 && lon < -120) return 32; // Pacifique Sud
  if (lat >= 0 && lat < 30 && lon >= 150) return 27; // Pacifique Ouest
  return null;
}

// ---------------------------------------------------------------------------
// Coupe du REF — départements français
// ---------------------------------------------------------------------------

/** Liste des 97 départements métropolitains + Corse (2A, 2B) + F6REF/00. */
export const FR_DEPARTMENTS: string[] = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "2A", "2B",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40",
  "41", "42", "43", "44", "45", "46", "47", "48", "49", "50",
  "51", "52", "53", "54", "55", "56", "57", "58", "59", "60",
  "61", "62", "63", "64", "65", "66", "67", "68", "69", "70",
  "71", "72", "73", "74", "75", "76", "77", "78", "79", "80",
  "81", "82", "83", "84", "85", "86", "87", "88", "89", "90",
  "91", "92", "93", "94", "95",
];

/** DOM/TOM français (préfixes DXCC). */
export const FR_DOMTOM: { prefix: string; name: string }[] = [
  { prefix: "FG", name: "Guadeloupe" },
  { prefix: "FM", name: "Martinique" },
  { prefix: "FR", name: "Réunion" },
  { prefix: "FY", name: "Guyane" },
  { prefix: "FP", name: "St-Pierre-et-Miquelon" },
  { prefix: "FS", name: "St-Martin" },
  { prefix: "FJ", name: "St-Barthélemy" },
  { prefix: "FK", name: "Nouvelle-Calédonie" },
  { prefix: "FO", name: "Polynésie française" },
  { prefix: "FW", name: "Wallis-et-Futuna" },
  { prefix: "FH", name: "Mayotte" },
  { prefix: "FT", name: "Terres australes" },
];

// ---------------------------------------------------------------------------
// Spot → Multiplicateurs (extraction côté client depuis les spots live)
// ---------------------------------------------------------------------------

export interface SpotMultiplier {
  /** Identifiant du multiplicateur (préfixe WPX, zone CQ, pays DXCC, zone ITU, dept FR, etc.) */
  id: string;
  /** Label lisible */
  label: string;
  /** Type de multiplicateur */
  type: "prefix" | "cq_zone" | "country" | "itu_zone" | "hq_station" | "department" | "domtom";
  /** Bande (null si toutes bandes confondues, ex: CQ WPX) */
  band: string | null;
  /** Nombre de spots correspondants */
  spotCount: number;
  /** Indicatifs des stations correspondantes */
  calls: string[];
}

export interface ContestMultipliers {
  contestId: ContestId;
  multipliers: SpotMultiplier[];
  totalUnique: number;
}

/** Interface minimale d'un spot pour l'extraction de multiplicateurs. */
export interface SpotLike {
  dx_call: string;
  dx_country: string | null;
  dx_dxcc_id: number | null;
  dx_cq_zone: number | null;
  dx_latitude: number | null;
  dx_longitude: number | null;
  dx_continent: string | null;
  band: string | null;
  mode: string | null;
  mode_type: string | null;
  comment: string | null;
  de_call: string;
  freq: number;
}

// ---------------------------------------------------------------------------
// Extraction par concours
// ---------------------------------------------------------------------------

/** CQ WPX : préfixes uniques, toutes bandes confondues. */
export function extractWpxMultipliers(spots: SpotLike[]): ContestMultipliers {
  const byPrefix = new Map<string, { calls: Set<string>; count: number }>();

  for (const s of spots) {
    const prefix = extractWpxPrefix(s.dx_call);
    if (!prefix) continue;
    let entry = byPrefix.get(prefix);
    if (!entry) {
      entry = { calls: new Set(), count: 0 };
      byPrefix.set(prefix, entry);
    }
    entry.calls.add(s.dx_call);
    entry.count++;
  }

  const multipliers: SpotMultiplier[] = Array.from(byPrefix.entries())
    .map(([prefix, data]) => ({
      id: prefix,
      label: prefix,
      type: "prefix" as const,
      band: null,
      spotCount: data.count,
      calls: Array.from(data.calls),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { contestId: "CQ_WPX", multipliers, totalUnique: multipliers.length };
}

/** CQ WW : zones CQ + pays DXCC, par bande. */
export function extractCqWwMultipliers(spots: SpotLike[]): ContestMultipliers {
  // Zones CQ par bande
  const zoneByBand = new Map<string, Map<number, { calls: Set<string>; count: number }>>();
  // Pays DXCC par bande
  const countryByBand = new Map<string, Map<string, { calls: Set<string>; count: number }>>();

  for (const s of spots) {
    if (!s.band) continue;

    // Zone CQ
    let cqZone = s.dx_cq_zone;
    if (!cqZone && s.dx_latitude != null && s.dx_longitude != null) {
      cqZone = cqZoneFromLatLon(s.dx_latitude, s.dx_longitude);
    }
    if (cqZone) {
      if (!zoneByBand.has(s.band)) zoneByBand.set(s.band, new Map());
      const bandMap = zoneByBand.get(s.band)!;
      let entry = bandMap.get(cqZone);
      if (!entry) {
        entry = { calls: new Set(), count: 0 };
        bandMap.set(cqZone, entry);
      }
      entry.calls.add(s.dx_call);
      entry.count++;
    }

    // Pays DXCC
    if (s.dx_country) {
      if (!countryByBand.has(s.band)) countryByBand.set(s.band, new Map());
      const bandMap = countryByBand.get(s.band)!;
      let entry = bandMap.get(s.dx_country);
      if (!entry) {
        entry = { calls: new Set(), count: 0 };
        bandMap.set(s.dx_country, entry);
      }
      entry.calls.add(s.dx_call);
      entry.count++;
    }
  }

  const multipliers: SpotMultiplier[] = [];
  const seen = new Set<string>();

  for (const [band, zones] of Array.from(zoneByBand)) {
    for (const [zone, data] of Array.from(zones)) {
      const key = `Z${zone}_${band}`;
      if (!seen.has(key)) {
        seen.add(key);
        multipliers.push({
          id: key,
          label: `Zone ${zone}`,
          type: "cq_zone",
          band,
          spotCount: data.count,
          calls: Array.from(data.calls),
        });
      }
    }
  }

  for (const [band, countries] of Array.from(countryByBand)) {
    for (const [country, data] of Array.from(countries)) {
      const key = `C_${country}_${band}`;
      if (!seen.has(key)) {
        seen.add(key);
        multipliers.push({
          id: key,
          label: country,
          type: "country",
          band,
          spotCount: data.count,
          calls: Array.from(data.calls),
        });
      }
    }
  }

  multipliers.sort((a, b) => {
    if (a.type !== b.type) return a.type === "cq_zone" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  // Compter les multiplicateurs uniques (zone+bande et pays+bande)
  return { contestId: "CQ_WW", multipliers, totalUnique: multipliers.length };
}

/** IARU HFC : zones ITU + stations HQ, par bande. */
export function extractIaruMultipliers(
  spots: SpotLike[],
  ituZoneFromLatLonFn: (lat: number, lon: number) => number | null,
  hqFromCallsignFn: (call: string) => { abbr: string; country: string } | null,
  looksLikeHQFn: (call: string, comment?: string) => boolean
): ContestMultipliers {
  const zoneByBand = new Map<string, Map<number, { calls: Set<string>; count: number }>>();
  const hqByBand = new Map<string, Map<string, { calls: Set<string>; count: number }>>();

  for (const s of spots) {
    if (!s.band) continue;

    // Zone ITU
    if (s.dx_latitude != null && s.dx_longitude != null) {
      const itu = ituZoneFromLatLonFn(s.dx_latitude, s.dx_longitude);
      if (itu) {
        if (!zoneByBand.has(s.band)) zoneByBand.set(s.band, new Map());
        const bandMap = zoneByBand.get(s.band)!;
        let entry = bandMap.get(itu);
        if (!entry) {
          entry = { calls: new Set(), count: 0 };
          bandMap.set(itu, entry);
        }
        entry.calls.add(s.dx_call);
        entry.count++;
      }
    }

    // Stations HQ
    if (looksLikeHQFn(s.dx_call, s.comment ?? undefined)) {
      const hq = hqFromCallsignFn(s.dx_call);
      if (hq) {
        if (!hqByBand.has(s.band)) hqByBand.set(s.band, new Map());
        const bandMap = hqByBand.get(s.band)!;
        let entry = bandMap.get(hq.abbr);
        if (!entry) {
          entry = { calls: new Set(), count: 0 };
          bandMap.set(hq.abbr, entry);
        }
        entry.calls.add(s.dx_call);
        entry.count++;
      }
    }
  }

  const multipliers: SpotMultiplier[] = [];

  for (const [band, zones] of Array.from(zoneByBand)) {
    for (const [zone, data] of Array.from(zones)) {
      multipliers.push({
        id: `ITU${zone}_${band}`,
        label: `ITU ${zone}`,
        type: "itu_zone",
        band,
        spotCount: data.count,
        calls: Array.from(data.calls),
      });
    }
  }

  for (const [band, hqs] of Array.from(hqByBand)) {
    for (const [abbr, data] of Array.from(hqs)) {
      multipliers.push({
        id: `HQ_${abbr}_${band}`,
        label: abbr,
        type: "hq_station",
        band,
        spotCount: data.count,
        calls: Array.from(data.calls),
      });
    }
  }

  multipliers.sort((a, b) => {
    if (a.type !== b.type) return a.type === "itu_zone" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return { contestId: "IARU_HFC", multipliers, totalUnique: multipliers.length };
}

/** Coupe du REF : départements FR + DOM/TOM, par bande. */
export function extractRefMultipliers(spots: SpotLike[]): ContestMultipliers {
  const deptByBand = new Map<string, Map<string, { calls: Set<string>; count: number }>>();
  const countryByBand = new Map<string, Map<string, { calls: Set<string>; count: number }>>();

  for (const s of spots) {
    if (!s.band) continue;

    // Stations françaises : extraire le département du commentaire ou de l'échange
    // Dans la Coupe du REF, les stations F envoient RST + département
    // On détecte les stations françaises par leur préfixe
    const isFrench = /^(F|TM|TK)/i.test(s.dx_call);

    if (isFrench) {
      // Essayer d'extraire le département du commentaire
      const dept = extractDepartment(s.comment, s.dx_call);
      if (dept) {
        if (!deptByBand.has(s.band)) deptByBand.set(s.band, new Map());
        const bandMap = deptByBand.get(s.band)!;
        let entry = bandMap.get(dept);
        if (!entry) {
          entry = { calls: new Set(), count: 0 };
          bandMap.set(dept, entry);
        }
        entry.calls.add(s.dx_call);
        entry.count++;
      }
    }

    // DOM/TOM : détecter par préfixe
    for (const dt of FR_DOMTOM) {
      if (s.dx_call.toUpperCase().startsWith(dt.prefix)) {
        if (!deptByBand.has(s.band)) deptByBand.set(s.band, new Map());
        const bandMap = deptByBand.get(s.band)!;
        const key = dt.prefix;
        let entry = bandMap.get(key);
        if (!entry) {
          entry = { calls: new Set(), count: 0 };
          bandMap.set(key, entry);
        }
        entry.calls.add(s.dx_call);
        entry.count++;
        break;
      }
    }

    // Pays DXCC non-français (multiplicateur pour les stations F)
    if (!isFrench && s.dx_country) {
      if (!countryByBand.has(s.band)) countryByBand.set(s.band, new Map());
      const bandMap = countryByBand.get(s.band)!;
      let entry = bandMap.get(s.dx_country);
      if (!entry) {
        entry = { calls: new Set(), count: 0 };
        bandMap.set(s.dx_country, entry);
      }
      entry.calls.add(s.dx_call);
      entry.count++;
    }
  }

  const multipliers: SpotMultiplier[] = [];

  for (const [band, depts] of Array.from(deptByBand)) {
    for (const [dept, data] of Array.from(depts)) {
      const domtom = FR_DOMTOM.find((d) => d.prefix === dept);
      multipliers.push({
        id: `D_${dept}_${band}`,
        label: domtom ? `${dept} (${domtom.name})` : `Dept ${dept}`,
        type: domtom ? "domtom" : "department",
        band,
        spotCount: data.count,
        calls: Array.from(data.calls),
      });
    }
  }

  for (const [band, countries] of Array.from(countryByBand)) {
    for (const [country, data] of Array.from(countries)) {
      multipliers.push({
        id: `C_${country}_${band}`,
        label: country,
        type: "country",
        band,
        spotCount: data.count,
        calls: Array.from(data.calls),
      });
    }
  }

  multipliers.sort((a, b) => {
    if (a.type !== b.type) {
      const order = ["department", "domtom", "country"];
      return order.indexOf(a.type) - order.indexOf(b.type);
    }
    return a.id.localeCompare(b.id);
  });

  return { contestId: "COUPE_REF", multipliers, totalUnique: multipliers.length };
}

/**
 * Tente d'extraire un numéro de département français du commentaire d'un spot
 * ou du chiffre dans l'indicatif (F6xxx → zone 6, mais pas un département).
 * En contest REF, le commentaire contient souvent "59 75" ou "599 33".
 */
function extractDepartment(comment: string | null, call: string): string | null {
  if (comment) {
    const c = comment.trim().toUpperCase();
    // Pattern typique : "59 75" ou "599 33" ou "5NN 2A"
    const match = c.match(/\b(5[9N]+)\s+(\d{1,2}[AB]?)\b/i);
    if (match) {
      const dept = match[2].toUpperCase();
      if (FR_DEPARTMENTS.includes(dept)) return dept;
      // Compléter avec un 0 devant si nécessaire
      const padded = dept.padStart(2, "0");
      if (FR_DEPARTMENTS.includes(padded)) return padded;
    }
    // Chercher un département isolé dans le commentaire
    const deptMatch = c.match(/\bDEPT?\s*(\d{1,2}[AB]?)\b/i);
    if (deptMatch) {
      const d = deptMatch[1].padStart(2, "0").toUpperCase();
      if (FR_DEPARTMENTS.includes(d)) return d;
    }
  }

  // Fallback : F6REF → département 00 (HQ)
  if (/^F6REF/i.test(call)) return "00";

  return null;
}
