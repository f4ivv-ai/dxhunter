export const PRIMARY_KIWI = {
  name: "KiwiSDR F4IVV — Marcilloles",
  callsign: "F4IVV",
  host: "23147.proxy.kiwisdr.com",
  port: 8073,
  url: "http://23147.proxy.kiwisdr.com:8073/",
  city: "Marcilloles",
  country: "FR",
  locator: "JN25oi",
  lat: 45.3399,
  lon: 5.18347,
} as const;

/**
 * Traduit le mode du spot vers le format compris par KiwiSDR.
 * En SSB, la bande latérale est déterminée par la fréquence :
 * LSB sous 10 MHz, USB à partir de 10 MHz.
 */
export function primaryKiwiMode(freqKhz: number, mode?: string): string {
  const normalized = (mode ?? "SSB").toUpperCase();
  if (normalized.includes("CW")) return "cw";
  if (normalized.includes("AM")) return "am";
  if (normalized.includes("FM")) return "fm";
  if (
    normalized.includes("FT8") ||
    normalized.includes("FT4") ||
    normalized.includes("DIGI")
  ) {
    return "usb";
  }
  return freqKhz >= 10_000 ? "usb" : "lsb";
}

/** Construit le lien direct vers le Kiwi F4IVV, déjà calé sur le spot. */
export function buildPrimaryKiwiTuneUrl(freqKhz: number, mode?: string): string {
  const baseUrl = PRIMARY_KIWI.url.replace(/\/$/, "");
  return `${baseUrl}/?f=${freqKhz.toFixed(2)}/${primaryKiwiMode(freqKhz, mode)}&z=10`;
}

/** Filtre fourni par F4IVV : émissions de F4IVV entendues ailleurs. */
export const F4IVV_TX_TOPIC = "pskr/filter/v2/+/+/F4IVV/+/+/+/+/+";

/** Filtre miroir indispensable : stations reçues par le décodeur F4IVV/Kiwi. */
export const F4IVV_RX_TOPIC = "pskr/filter/v2/+/+/+/F4IVV/+/+/+/+";

/** Secours local lorsque le décodeur F4IVV ne publie pas encore de rapport. */
export const JN25_RX_TOPIC = "pskr/filter/v2/+/+/+/+/+/JN25/+/+";

export const F4IVV_PROPAGATION_TOPICS = [
  F4IVV_TX_TOPIC,
  F4IVV_RX_TOPIC,
  JN25_RX_TOPIC,
] as const;
