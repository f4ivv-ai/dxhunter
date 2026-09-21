/**
 * Grille de récepteurs WebSDR / KiwiSDR couvrant tous les axes utiles pour
 * écouter "depuis" chaque zone cible sur 40 m, pendant que TM0HQ émet depuis JN25.
 *
 * Objectif : permettre à l'écouteur de l'équipe de vérifier instantanément si
 * TM0HQ est entendu dans une région, et de surveiller l'activité 40 m locale
 * à l'autre bout d'un trajet (utile pour confirmer une ouverture avant d'engager).
 *
 * Les liens WebSDR (logiciel PA3FWM) acceptent des paramètres de réglage dans
 * l'URL hash (tune en kHz + mode). Les KiwiSDR acceptez `?f=FREQ<mode>z<zoom>`.
 * Les fréquences par défaut visent la portion SSB 40 m (7.1-7.2 MHz, LSB).
 */

export type Axis = "Europe" | "Est" | "Ouest" | "Nord" | "Sud" | "Îles" | "Asie-Pacifique";

export interface WebSDRStation {
  id: string;
  name: string;
  /** localisation lisible */
  location: string;
  /** continent / axe pour le regroupement */
  axis: Axis;
  /** grille / direction depuis JN25 que ce récepteur aide à surveiller */
  covers: string;
  /** type de logiciel : websdr (PA3FWM) ou kiwi */
  kind: "websdr" | "kiwi";
  /** URL de base */
  url: string;
  /** URL pré-réglée sur 40 m SSB si possible */
  tuned: string;
}

/** Construit une URL WebSDR pré-réglée (kHz, mode lsb) pour la portion SSB 40 m. */
function websdrTune(base: string, khz = 7150): string {
  const sep = base.includes("?") ? "&" : "?";
  // le logiciel WebSDR lit ?tune=FREQlsb
  return `${base}${sep}tune=${khz}lsb`;
}

/** Construit une URL KiwiSDR pré-réglée (f=FREQ + mode lsb + zoom). */
function kiwiTune(base: string, khz = 7150): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}f=${khz}lsbz9`;
}

const RAW: Omit<WebSDRStation, "tuned">[] = [
  // --- Europe (contrôle local : suis-je fort en EU ?) ---
  {
    id: "twente",
    name: "WebSDR U. Twente",
    location: "Enschede, Pays-Bas",
    axis: "Europe",
    covers: "Référence EU (le plus stable au monde)",
    kind: "websdr",
    url: "http://websdr.ewi.utwente.nl:8901/",
  },
  {
    id: "suws",
    name: "SUWS WebSDR",
    location: "Farnham, Angleterre",
    axis: "Europe",
    covers: "EU de l'Ouest / Manche",
    kind: "websdr",
    url: "http://websdr.suws.org.uk/",
  },
  // --- Nord (Scandinavie / chemins polaires) ---
  {
    id: "oh-kiwi",
    name: "KiwiSDR Finlande",
    location: "Finlande (OH)",
    axis: "Nord",
    covers: "ITU 18 — Scandinavie, chemins nord",
    kind: "kiwi",
    url: "http://kiwisdr.fi:8073/",
  },
  // --- Est (Russie d'Asie, Moyen-Orient, Inde) ---
  {
    id: "ua9-kiwi",
    name: "KiwiSDR Oural",
    location: "Russie (UA9)",
    axis: "Est",
    covers: "ITU 30/31 — Asie centrale, long path",
    kind: "kiwi",
    url: "http://sdr-ural.ddns.net:8073/",
  },
  {
    id: "4x-kiwi",
    name: "KiwiSDR Israël",
    location: "Tel Aviv (4X)",
    axis: "Est",
    covers: "ITU 39 — Moyen-Orient",
    kind: "kiwi",
    url: "http://4x6izsdr.ddns.net:8073/",
  },
  {
    id: "vu-kiwi",
    name: "KiwiSDR Inde",
    location: "Inde (VU)",
    axis: "Est",
    covers: "ITU 41 — sous-continent indien",
    kind: "kiwi",
    url: "http://vu2jcr.proxy.kiwisdr.com:8073/",
  },
  // --- Asie-Pacifique (Japon, Asie SE) ---
  {
    id: "ja-kiwi",
    name: "KiwiSDR Japon",
    location: "Japon (JA)",
    axis: "Asie-Pacifique",
    covers: "ITU 45 — Japon (SP matin / LP soir)",
    kind: "kiwi",
    url: "http://aki.ddns.net:8073/",
  },
  {
    id: "yb-kiwi",
    name: "KiwiSDR Indonésie",
    location: "Indonésie (YB)",
    axis: "Asie-Pacifique",
    covers: "ITU 51/54 — Asie SE",
    kind: "kiwi",
    url: "http://yb0use.proxy.kiwisdr.com:8073/",
  },
  // --- Sud (Océanie, Amérique du Sud, Afrique) ---
  {
    id: "vk-kiwi",
    name: "KiwiSDR Australie",
    location: "Australie Est (VK)",
    axis: "Asie-Pacifique",
    covers: "ITU 59 — VK (long path)",
    kind: "kiwi",
    url: "http://vk2gv.proxy.kiwisdr.com:8073/",
  },
  {
    id: "zl-kiwi",
    name: "KiwiSDR Nouvelle-Zélande",
    location: "Nouvelle-Zélande (ZL)",
    axis: "Asie-Pacifique",
    covers: "ITU 60 — ZL (antipode, long path)",
    kind: "kiwi",
    url: "http://kiwisdr.aucklandcity.ac.nz:8073/",
  },
  {
    id: "py-kiwi",
    name: "KiwiSDR Brésil",
    location: "Brésil (PY)",
    axis: "Sud",
    covers: "ITU 15 — Amérique du Sud",
    kind: "kiwi",
    url: "http://py2-sdr.proxy.kiwisdr.com:8073/",
  },
  {
    id: "zs-kiwi",
    name: "KiwiSDR Afrique du Sud",
    location: "Afrique du Sud (ZS)",
    axis: "Sud",
    covers: "ITU 57 — Afrique australe",
    kind: "kiwi",
    url: "http://zs6-sdr.proxy.kiwisdr.com:8073/",
  },
  // --- Ouest (Amériques) ---
  {
    id: "na5b",
    name: "NA5B WebSDR",
    location: "Washington DC, USA",
    axis: "Ouest",
    covers: "ITU 8 — USA Est / côte atlantique",
    kind: "websdr",
    url: "http://na5b.com:8901/",
  },
  {
    id: "utah",
    name: "Northern Utah WebSDR",
    location: "Utah, USA",
    axis: "Ouest",
    covers: "ITU 6/7 — USA Ouest / Pacifique",
    kind: "websdr",
    url: "http://websdr1.sdrutah.org:8901/",
  },
  // --- Îles ---
  {
    id: "kh6-kiwi",
    name: "KiwiSDR Hawaï",
    location: "Hawaï (KH6)",
    axis: "Îles",
    covers: "ITU 61 — Pacifique central (long path)",
    kind: "kiwi",
    url: "http://kh6-sdr.proxy.kiwisdr.com:8073/",
  },
  {
    id: "carib-kiwi",
    name: "KiwiSDR Caraïbes",
    location: "Bonaire (PJ4)",
    axis: "Îles",
    covers: "ITU 11 — Caraïbes / Amérique centrale",
    kind: "kiwi",
    url: "http://pj4-sdr.proxy.kiwisdr.com:8073/",
  },
];

export const WEBSDRS: WebSDRStation[] = RAW.map((s) => ({
  ...s,
  tuned: s.kind === "websdr" ? websdrTune(s.url) : kiwiTune(s.url),
}));

export const AXES: Axis[] = ["Europe", "Nord", "Est", "Asie-Pacifique", "Sud", "Ouest", "Îles"];
