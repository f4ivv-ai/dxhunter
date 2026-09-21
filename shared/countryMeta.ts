/**
 * Country metadata: ISO 2-letter code → flag emoji + continent.
 * Used for visual display in WebSDR listings (Self-Monitor, SpotDetail).
 */

export type Continent = "EU" | "NA" | "SA" | "AS" | "AF" | "OC";

export interface CountryMeta {
  flag: string;
  continent: Continent;
  name: string;
}

/**
 * Convert ISO 2-letter country code to flag emoji.
 * Uses regional indicator symbols (Unicode).
 */
export function countryToFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "🏳️";
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65
  );
}

/** Continent labels for display */
export const CONTINENT_LABELS: Record<Continent, string> = {
  EU: "Europe",
  NA: "Am. Nord",
  SA: "Am. Sud",
  AS: "Asie",
  AF: "Afrique",
  OC: "Océanie",
};

/** Short continent labels */
export const CONTINENT_SHORT: Record<Continent, string> = {
  EU: "EU",
  NA: "NA",
  SA: "SA",
  AS: "AS",
  AF: "AF",
  OC: "OC",
};

/**
 * Mapping of all country codes used in websdr-db.json to their continent.
 */
const COUNTRY_CONTINENT: Record<string, Continent> = {
  // Europe
  AT: "EU", BA: "EU", BE: "EU", BG: "EU", CH: "EU", CY: "EU", CZ: "EU",
  DE: "EU", DK: "EU", EE: "EU", ES: "EU", FI: "EU", FR: "EU", GB: "EU",
  GE: "EU", GG: "EU", GR: "EU", HR: "EU", HU: "EU", IE: "EU", IM: "EU",
  IS: "EU", IT: "EU", JE: "EU", LT: "EU", LU: "EU", LV: "EU", MK: "EU",
  NL: "EU", NO: "EU", PL: "EU", PT: "EU", RO: "EU", RS: "EU", RU: "EU",
  SE: "EU", SI: "EU", SK: "EU", SM: "EU", TR: "EU", UA: "EU", VA: "EU",
  // North America
  BM: "NA", BQ: "NA", CA: "NA", CR: "NA", MX: "NA", PR: "NA", US: "NA",
  // South America
  AR: "SA", BR: "SA", CL: "SA", CO: "SA", EC: "SA", PE: "SA", PY: "SA", UY: "SA",
  // Asia
  CN: "AS", HK: "AS", ID: "AS", IL: "AS", IN: "AS", IQ: "AS", JP: "AS",
  KR: "AS", MO: "AS", MY: "AS", NP: "AS", PH: "AS", QA: "AS", SA: "AS",
  SG: "AS", TH: "AS", TW: "AS", VN: "AS",
  // Africa
  KE: "AF", ZA: "AF", RE: "AF",
  // Oceania
  AU: "OC", NZ: "OC",
};

/**
 * Get continent for a country code. Falls back to "EU" if unknown.
 */
export function getContinent(countryCode: string): Continent {
  return COUNTRY_CONTINENT[countryCode.toUpperCase()] ?? "EU";
}

/**
 * Get full metadata for a country code.
 */
export function getCountryMeta(countryCode: string): { flag: string; continent: Continent; continentLabel: string } {
  const code = countryCode.toUpperCase();
  const continent = getContinent(code);
  return {
    flag: countryToFlag(code),
    continent,
    continentLabel: CONTINENT_LABELS[continent],
  };
}
