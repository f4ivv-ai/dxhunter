/**
 * WebSDR proximity module.
 * Given a DX callsign (or country/locator), finds the nearest WebSDR/KiwiSDR
 * receivers and generates direct-tune URLs with frequency and mode pre-set.
 */

import sdrDb from "../shared/websdr-db.json";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface SdrEntry {
  name: string;
  url: string;
  locator: string;
  lat: number;
  lon: number;
  country: string;
  city: string;
  type: "websdr" | "kiwisdr" | "openwebrx";
  /** Récepteur local de référence, à mettre en tête des listes locales. */
  priority?: boolean;
}

export interface NearbySdr {
  name: string;
  tuneUrl: string;
  distanceKm: number;
  city: string;
  country: string;
  type: string;
}

// ─── Maidenhead → lat/lon ───────────────────────────────────────────────────
export function locatorToLatLon(loc: string): { lat: number; lon: number } | null {
  if (!loc || loc.length < 4) return null;
  const l = loc.toUpperCase();
  const lon = (l.charCodeAt(0) - 65) * 20 - 180 + Number(l[2]) * 2 + (loc.length >= 6 ? (l.charCodeAt(4) - 65) / 12 + 1 / 24 : 1);
  const lat = (l.charCodeAt(1) - 65) * 10 - 90 + Number(l[3]) * 1 + (loc.length >= 6 ? (l.charCodeAt(5) - 65) / 24 + 1 / 48 : 0.5);
  return { lat, lon };
}

// ─── Haversine distance (km) ────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Mode mapping ───────────────────────────────────────────────────────────
function mapMode(mode: string | undefined, type: string, freqKhz?: number): string {
  const m = (mode ?? "SSB").toUpperCase();
  // SSB/USB/LSB : toujours déterminer par la fréquence (< 10 MHz = LSB)
  if (m === "SSB" || m === "USB" || m === "LSB" || m.includes("SSB")) {
    if (freqKhz !== undefined) return ssbSide(freqKhz);
    return "usb"; // fallback si pas de freq
  }
  if (m.includes("CW")) return "cw";
  if (m.includes("AM")) return "am";
  if (m.includes("FM")) return type === "openwebrx" ? "nfm" : "fm";
  if (m.includes("FT8") || m.includes("FT4") || m.includes("DIGI")) return "usb";
  // Default: déterminer par la fréquence
  if (freqKhz !== undefined) return ssbSide(freqKhz);
  return "usb";
}

function ssbSide(freqKhz: number): string {
  return freqKhz >= 10000 ? "usb" : "lsb";
}

// ─── Generate tune URL ──────────────────────────────────────────────────────
export function buildTuneUrl(baseUrl: string, type: string, freqKhz: number, mode?: string): string {
  const modeStr = mode ? mapMode(mode, type, freqKhz) : ssbSide(freqKhz);
  const cleanBase = baseUrl.replace(/\/$/, "");

  switch (type) {
    case "kiwisdr":
      // KiwiSDR: /?f=<freqKhz>/<mode>&z=10
      return `${cleanBase}/?f=${freqKhz.toFixed(2)}/${modeStr}&z=10`;
    case "websdr":
      // WebSDR: /?tune=<freqKhz><mode>
      return `${cleanBase}/?tune=${freqKhz.toFixed(1)}${modeStr}`;
    case "openwebrx":
      // OpenWebRX: /#freq=<freqHz>,mod=<mode>
      return `${cleanBase}/#freq=${Math.round(freqKhz * 1000)},mod=${modeStr}`;
    default:
      return `${cleanBase}/?tune=${freqKhz.toFixed(1)}${modeStr}`;
  }
}

// ─── Country prefix → approximate locator ───────────────────────────────────
// Mapping of common DXCC prefixes to approximate center locators
const PREFIX_LOCATORS: Record<string, string> = {
  // Europe
  F: "JN18", G: "IO91", DL: "JO51", I: "JN62", EA: "IN80", CT: "IM58",
  PA: "JO22", ON: "JO20", LX: "JN39", HB: "JN47", OE: "JN78", OK: "JN79",
  SP: "JO91", HA: "JN97", YO: "KN25", LZ: "KN22", SV: "KM17", YU: "KN04",
  S5: "JN76", "9A": "JN85", OZ: "JO55", SM: "JO89", OH: "KP20", LA: "JO59",
  ES: "KO29", YL: "KO26", LY: "KO24", UR: "KO50", UA: "KO85", EI: "IO63",
  GW: "IO81", GM: "IO85", GI: "IO65", TK: "JN42", ZA: "KN01",
  // Europe - special prefixes
  EM: "KO50", EN: "KO50", EO: "KO50", // Ukraine
  HF: "JO91", SN: "JO91", SO: "JO91", "3Z": "JO91", // Poland
  SD: "JO89", SE: "JO89", SF: "JO89", SG: "JO89", SH: "JO89", SI: "JO89", SJ: "JO89", SK: "JO89", // Sweden
  EH: "IN80", // Spain
  II: "JN62", IQ: "JN62", IR: "JN62", // Italy
  DA: "JO51", DB: "JO51", DC: "JO51", DD: "JO51", DE: "JO51", DF: "JO51", DG: "JO51", DH: "JO51", DI: "JO51", DJ: "JO51", DK: "JO51", DM: "JO51", DN: "JO51", DO: "JO51", DP: "JO51", DQ: "JO51", DR: "JO51", // Germany
  TM: "JN18", TF: "HP94", // France / Iceland
  OP: "JO20", OQ: "JO20", OR: "JO20", OS: "JO20", OT: "JO20", // Belgium
  CS: "IM58", // Portugal
  RW: "KO85", RX: "KO85", RI: "KO85", RK: "KO85", RA: "KO85", RU: "KO85", R1: "KO85", // Russia
  "8A": "OI33", // Indonesia
  // Americas
  W: "EM79", K: "EM79", N: "EM79", VE: "FN25", XE: "EK09", PY: "GG87",
  LU: "GF05", CE: "FF46", HC: "FI09", HK: "FJ34", YV: "FJ69",
  CO: "EL82", HI: "FK48", PJ: "FK52", VP2: "FK87", ZP: "GG14",
  PW: "GG87", PP: "GG87", PR: "GG87", PS: "GG87", PT: "GG87", PU: "GG87", // Brazil
  WM: "EM79", // USA special
  // Asia
  JA: "PM95", HL: "PM37", BV: "PL04", BY: "OM89", VU: "MK83",
  A4: "LL93", A6: "LL75", A7: "LL55", "9K": "LL49", HZ: "KL61",
  HS: "NK99", "9V": "OJ11", YB: "OI33", DU: "PK04", VR: "OL72",
  // Africa
  ZS: "KG33", "5Z": "KI88", "5N": "JJ26", ST: "KK65", SU: "KL30",
  CN: "IM63", "7X": "JM16", "3V": "JM54", "5T": "IK57", D4: "HK76",
  "6W": "IK14", TU: "IJ46", "9G": "IJ95", TR: "JI31", "5H": "KI73",
  // Oceania
  VK: "QF56", ZL: "RE66", FK: "RG37", FO: "BH51", KH6: "BL01",
  // Misc / Polar
  UA9: "NO14", UA0: "QN07",
  HF0: "GC40", // South Shetland
  VP8: "GC40", // Falklands/South Shetland
  SX: "KM17", // Greece
};

export function callToLocator(call: string): string | null {
  // Try longest prefix match
  const upper = call.toUpperCase().replace(/\/.*$/, ""); // strip /P, /QRP etc.
  for (let len = 3; len >= 1; len--) {
    const prefix = upper.substring(0, len);
    if (PREFIX_LOCATORS[prefix]) return PREFIX_LOCATORS[prefix];
  }
  return null;
}

// ─── Main function: find nearby SDRs ────────────────────────────────────────
export function findNearbyWebsdr(
  dxCall: string,
  freqKhz: number,
  mode?: string,
  dxLocator?: string,
  maxResults = 5,
  dxLat?: number | null,
  dxLon?: number | null
): NearbySdr[] {
  // Determine DX position — prefer direct lat/lon, then locator, then prefix
  let dxPos: { lat: number; lon: number } | null = null;
  if (dxLat != null && dxLon != null && isFinite(dxLat) && isFinite(dxLon)) {
    dxPos = { lat: dxLat, lon: dxLon };
  }
  if (!dxPos && dxLocator) {
    dxPos = locatorToLatLon(dxLocator);
  }
  if (!dxPos) {
    const loc = callToLocator(dxCall);
    if (loc) dxPos = locatorToLatLon(loc);
  }
  if (!dxPos) {
    // Fallback: return a global selection
    return [];
  }

  // Calculate distance to each SDR and sort
  const withDist = (sdrDb as SdrEntry[]).map((sdr) => ({
    ...sdr,
    distanceKm: haversineKm(dxPos!.lat, dxPos!.lon, sdr.lat, sdr.lon),
  }));

  withDist.sort((a, b) => a.distanceKm - b.distanceKm);

  // Take top N
  return withDist.slice(0, maxResults).map((sdr) => ({
    name: sdr.name,
    tuneUrl: buildTuneUrl(sdr.url, sdr.type, freqKhz, mode),
    distanceKm: Math.round(sdr.distanceKm),
    city: sdr.city,
    country: sdr.country,
    type: sdr.type,
  }));
}
