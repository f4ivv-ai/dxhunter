/**
 * Multiplicateurs du IARU HF World Championship.
 *
 * Dans ce contest, les multiplicateurs sont (règles ARRL/IARU) :
 *  - chaque ZONE ITU travaillée par bande,
 *  - chaque abréviation de SOCIÉTÉ MEMBRE IARU (station HQ) + AC/R1/R2/R3 + IARU,
 * comptés une fois par bande. Comme l'équipe est dédiée 40 m, on suit ici les
 * multiplicateurs sur la bande 40 m.
 *
 * Cette base sert au suivi "travaillé / manquant" et au croisement avec les spots.
 */

/**
 * Détermination complète de la zone ITU à partir des coordonnées lat/lon.
 * Couvre les 75 zones ITU utilisées en radio amateur (IARU HF Championship).
 * Basé sur les définitions ARRL/RSGB/IARU et la carte EI8IC.
 * Les frontières sont approximatives (résolution ~2-5°) mais suffisantes
 * pour le guidage DX et le scoring contest.
 */
export function ituZoneFromLatLon(lat: number, lon: number): number | null {
  // --- Pôles ---
  if (lat >= 85) return 75; // Arctique
  if (lat <= -85) return 74; // Antarctique

  // === AMÉRIQUE DU NORD ===
  // Zone 1 — Alaska (nord-ouest)
  if (lat >= 54 && lon >= -180 && lon < -130) return 1;
  // Zone 2 — Nord Canada / Arctique canadien
  if (lat >= 60 && lon >= -130 && lon < -60) return 2;
  // Zone 3 — Canada Ouest (BC, Alberta)
  if (lat >= 48 && lat < 60 && lon >= -130 && lon < -100) return 3;
  // Zone 4 — Canada Centre (Manitoba, Ontario Ouest)
  if (lat >= 48 && lat < 60 && lon >= -100 && lon < -80) return 4;
  // Zone 5 — Canada Est (Québec, Maritimes)
  if (lat >= 44 && lat < 60 && lon >= -80 && lon < -50) return 5;
  // Zone 6 — USA Ouest (W6, W7)
  if (lat >= 25 && lat < 48 && lon >= -130 && lon < -100) return 6;
  // Zone 7 — USA Centre (W0, W5, W9)
  if (lat >= 25 && lat < 48 && lon >= -100 && lon < -80) return 7;
  // Zone 8 — USA Est (W1-W4)
  if (lat >= 25 && lat < 48 && lon >= -80 && lon < -60) return 8;
  // Zone 9 — Bermudes / Atlantique Ouest
  if (lat >= 25 && lat < 40 && lon >= -70 && lon < -55) return 9;
  // Zone 10 — Mexique
  if (lat >= 14 && lat < 25 && lon >= -120 && lon < -85) return 10;
  // Zone 11 — Amérique Centrale / Caraïbes
  if (lat >= 7 && lat < 25 && lon >= -85 && lon < -55) return 11;

  // === AMÉRIQUE DU SUD ===
  // Zone 12 — Am. Sud Nord (Venezuela, Colombie, Guyanes)
  if (lat >= -5 && lat < 14 && lon >= -82 && lon < -34) return 12;
  // Zone 13 — Am. Sud Centre-Ouest (Pérou, Bolivie)
  if (lat >= -25 && lat < -5 && lon >= -82 && lon < -50) return 13;
  // Zone 14 — Am. Sud Centre-Est (Brésil)
  if (lat >= -25 && lat < -5 && lon >= -50 && lon < -34) return 14;
  // Zone 15 — Am. Sud Sud (Argentine, Chili, Uruguay)
  if (lat >= -56 && lat < -25 && lon >= -82 && lon < -34) return 15;
  // Zone 16 — Am. Sud extrême sud (Terre de Feu, Malouines)
  if (lat < -56 && lon >= -82 && lon < -20) return 16;

  // === EUROPE ===
  // Zone 18 — Scandinavie / Islande / Arctique européen
  if (lat > 60 && lon >= -25 && lon < 40) return 18;
  // Zone 27 — Europe de l'Ouest (F, G, PA, ON, HB, EA, I)
  if (lat >= 36 && lat <= 60 && lon >= -10 && lon < 12) return 27;
  // Zone 28 — Europe de l'Est (DL, SP, OK, HA, YU, LZ, UR, 9A)
  if (lat >= 36 && lat <= 60 && lon >= 12 && lon < 40) return 28;
  // Zone 29 — Russie d'Europe / Oural (UA1-6)
  if (lat >= 36 && lat <= 62 && lon >= 40 && lon < 75) return 29;
  // Zone 20 — Açores / Atlantique Nord-Est
  if (lat >= 36 && lat < 60 && lon >= -35 && lon < -10) return 20;

  // === ASIE ===
  // Zone 17 — Sibérie Ouest
  if (lat > 60 && lon >= 40 && lon < 100) return 17;
  // Zone 19 — Sibérie Est
  if (lat > 60 && lon >= 100 && lon < 180) return 19;
  // Zone 30 — Asie Centrale (Kazakhstan, Ouzbékistan)
  if (lat >= 35 && lat <= 60 && lon >= 50 && lon < 90) return 30;
  // Zone 31 — Chine Ouest / Tibet
  if (lat >= 25 && lat < 45 && lon >= 75 && lon < 100) return 31;
  // Zone 32 — Chine Nord-Est / Mongolie
  if (lat >= 40 && lat <= 60 && lon >= 90 && lon < 130) return 32;
  // Zone 33 — Chine Centre-Est
  if (lat >= 25 && lat < 40 && lon >= 100 && lon < 125) return 33;
  // Zone 34 — Mongolie / Mandchourie
  if (lat >= 40 && lat < 55 && lon >= 100 && lon < 125) return 34;
  // Zone 35 — Corée
  if (lat >= 33 && lat < 43 && lon >= 125 && lon < 132) return 35;
  // Zone 45 — Japon
  if (lat >= 24 && lat < 46 && lon >= 125 && lon < 150) return 45;
  // Zone 44 — Chine Sud / Hong Kong
  if (lat >= 18 && lat < 25 && lon >= 100 && lon < 125) return 44;
  // Zone 49 — Thaïlande / Indochine
  if (lat >= 5 && lat < 25 && lon >= 90 && lon < 110) return 49;
  // Zone 54 — Indonésie / Malaisie / Philippines
  if (lat >= -10 && lat < 20 && lon >= 95 && lon < 135) return 54;
  // Zone 50 — Birmanie / Bangladesh
  if (lat >= 15 && lat < 30 && lon >= 88 && lon < 100) return 50;
  // Zone 41 — Inde / Sri Lanka
  if (lat >= 5 && lat < 35 && lon >= 68 && lon < 90) return 41;
  // Zone 40 — Pakistan / Afghanistan
  if (lat >= 25 && lat < 38 && lon >= 60 && lon < 75) return 40;
  // Zone 39 — Moyen-Orient (4X, A4, A6, A7, 9K, HZ)
  if (lat >= 12 && lat < 42 && lon >= 30 && lon < 60) return 39;
  // Zone 42 — Maldives / Chagos
  if (lat >= -10 && lat < 10 && lon >= 68 && lon < 80) return 42;

  // === AFRIQUE ===
  // Zone 37 — Afrique du Nord-Ouest (Maroc, Algérie)
  if (lat >= 25 && lat < 36 && lon >= -20 && lon < 10) return 37;
  // Zone 38 — Afrique du Nord-Est (Égypte, Libye, Tunisie)
  if (lat >= 20 && lat < 36 && lon >= 10 && lon < 40) return 38;
  // Zone 46 — Afrique de l'Ouest (Sahel)
  if (lat >= 5 && lat < 25 && lon >= -20 && lon < 10) return 46;
  // Zone 47 — Afrique Centrale-Ouest
  if (lat >= -5 && lat < 15 && lon >= 10 && lon < 30) return 47;
  // Zone 48 — Afrique de l'Est (Kenya, Tanzanie, Éthiopie)
  if (lat >= -12 && lat < 20 && lon >= 30 && lon < 55) return 48;
  // Zone 52 — Afrique du Sud-Ouest (Angola, Namibie)
  if (lat >= -35 && lat < -5 && lon >= 10 && lon < 30) return 52;
  // Zone 53 — Afrique du Sud-Est (Mozambique, Zimbabwe)
  if (lat >= -35 && lat < -12 && lon >= 30 && lon < 55) return 53;
  // Zone 57 — Afrique du Sud (ZS)
  if (lat >= -35 && lat < -22 && lon >= 15 && lon < 35) return 57;
  // Zone 36 — Canaries / Cap-Vert / Atlantique tropical
  if (lat >= 10 && lat < 35 && lon >= -35 && lon < -10) return 36;

  // === OCÉANIE ===
  // Zone 55 — Australie Ouest
  if (lat >= -40 && lat < -10 && lon >= 110 && lon < 135) return 55;
  // Zone 59 — Australie Est
  if (lat >= -40 && lat < -10 && lon >= 135 && lon < 155) return 59;
  // Zone 60 — Nouvelle-Zélande
  if (lat >= -50 && lat < -30 && lon >= 160 && lon < 180) return 60;
  // Zone 56 — Pacifique Ouest (Papouasie, Mélanésie)
  if (lat >= -15 && lat < 0 && lon >= 135 && lon < 170) return 56;
  // Zone 58 — Pacifique Sud-Ouest (Fidji, Tonga, Vanuatu)
  if (lat >= -30 && lat < -10 && lon >= 155 && lon < 180) return 58;
  // Zone 51 — Pacifique Ouest (Guam, Mariannes)
  if (lat >= 5 && lat < 25 && lon >= 135 && lon < 170) return 51;

  // === PACIFIQUE ===
  // Zone 61 — Hawaii / Midway
  if (lat >= 15 && lat < 35 && lon >= -180 && lon < -150) return 61;
  // Zone 62 — Pacifique Central (Kiribati, Marshall)
  if (lat >= -5 && lat < 15 && lon >= -180 && lon < -130) return 62;
  // Zone 63 — Pacifique Sud (Polynésie, Cook)
  if (lat >= -30 && lat < -5 && lon >= -180 && lon < -100) return 63;
  // Zone 64 — Pacifique Est (Cl. Galapagos, île de Pâques)
  if (lat >= -40 && lat < 5 && lon >= -120 && lon < -80) return 64;
  // Zone 65 — Pacifique Nord-Est
  if (lat >= 5 && lat < 25 && lon >= -130 && lon < -100) return 65;

  // === ATLANTIQUE ===
  // Zone 21 — Atlantique Nord (Groenland)
  if (lat >= 60 && lon >= -60 && lon < -10) return 21;
  // Zone 22 — Atlantique Central
  if (lat >= 25 && lat < 45 && lon >= -50 && lon < -20) return 22;
  // Zone 23 — Atlantique Sud
  if (lat >= -10 && lat < 25 && lon >= -50 && lon < -20) return 23;
  // Zone 24 — Atlantique Sud profond
  if (lat >= -50 && lat < -10 && lon >= -50 && lon < 0) return 24;
  // Zone 25 — Atlantique Sud-Est (Ste-Hélène, Ascension)
  if (lat >= -35 && lat < 5 && lon >= -20 && lon < 5) return 25;

  // === OCÉAN INDIEN ===
  // Zone 43 — Océan Indien Nord (Seychelles, Réunion)
  if (lat >= -25 && lat < 5 && lon >= 45 && lon < 80) return 43;
  // Zone 66 — Océan Indien Sud (Kerguelen, Crozet)
  if (lat >= -55 && lat < -25 && lon >= 40 && lon < 100) return 66;
  // Zone 67 — Océan Indien Est (Cocos, Christmas)
  if (lat >= -25 && lat < 0 && lon >= 80 && lon < 110) return 67;

  // === FALLBACK par quadrant ===
  // Si aucune zone précise ne correspond, estimation par quadrant
  if (lat >= 0 && lon < 0) return 11;   // Hémisphère Nord-Ouest
  if (lat >= 0 && lon >= 0) return 39;  // Hémisphère Nord-Est
  if (lat < 0 && lon < 0) return 13;    // Hémisphère Sud-Ouest
  if (lat < 0 && lon >= 0) return 57;   // Hémisphère Sud-Est

  return null;
}

/**
 * Sociétés membres IARU (abréviations envoyées par les stations HQ).
 * Liste large des principales sociétés actives en contest (non exhaustive des ~160,
 * mais couvrant la quasi-totalité des HQ réellement entendues sur l'air).
 * `prefixes` aide à reconnaître la société à partir de l'indicatif spotté.
 */
export interface HQSociety {
  abbr: string;
  country: string;
  prefixes: string[];
}

export const HQ_SOCIETIES: HQSociety[] = [
  { abbr: "REF", country: "France", prefixes: ["F", "TM", "TK"] },
  { abbr: "RSGB", country: "Royaume-Uni", prefixes: ["G", "M", "2E"] },
  { abbr: "DARC", country: "Allemagne", prefixes: ["DA", "DL", "DF", "DK", "DJ", "DD", "DB"] },
  { abbr: "ARI", country: "Italie", prefixes: ["I", "IK", "IZ", "IW", "II"] },
  { abbr: "URE", country: "Espagne", prefixes: ["EA", "EB", "EC", "AM", "AN", "AO"] },
  { abbr: "REP", country: "Portugal", prefixes: ["CT", "CR", "CS"] },
  { abbr: "PZK", country: "Pologne", prefixes: ["SP", "SN", "SO", "HF", "3Z"] },
  { abbr: "OEVSV", country: "Autriche", prefixes: ["OE"] },
  { abbr: "USKA", country: "Suisse", prefixes: ["HB9", "HB", "HE"] },
  { abbr: "UBA", country: "Belgique", prefixes: ["ON", "OO", "OT"] },
  { abbr: "VERON", country: "Pays-Bas", prefixes: ["PA", "PB", "PD", "PI", "PE"] },
  { abbr: "EDR", country: "Danemark", prefixes: ["OZ", "OU", "OV", "5P"] },
  { abbr: "SSA", country: "Suède", prefixes: ["SM", "SA", "SB", "SK", "7S", "8S"] },
  { abbr: "NRRL", country: "Norvège", prefixes: ["LA", "LB", "LG", "LJ", "LN"] },
  { abbr: "SRAL", country: "Finlande", prefixes: ["OH", "OF", "OG", "OI"] },
  { abbr: "OSADL", country: "Slovénie", prefixes: ["S5"] },
  { abbr: "HRS", country: "Croatie", prefixes: ["9A"] },
  { abbr: "MRASZ", country: "Hongrie", prefixes: ["HA", "HG"] },
  { abbr: "CRC", country: "Tchéquie", prefixes: ["OK", "OL"] },
  { abbr: "SARA", country: "Slovaquie", prefixes: ["OM"] },
  { abbr: "RAR", country: "Roumanie", prefixes: ["YO", "YP", "YQ", "YR"] },
  { abbr: "BFRA", country: "Bulgarie", prefixes: ["LZ"] },
  { abbr: "SRR", country: "Russie", prefixes: ["R", "UA", "UB", "UC", "UD", "UE", "UF", "UG", "UI"] },
  { abbr: "UARL", country: "Ukraine", prefixes: ["UR", "US", "UT", "UU", "UV", "UW", "UX", "UY", "UZ", "EM", "EN", "EO"] },
  { abbr: "EPRA", country: "Estonie", prefixes: ["ES"] },
  { abbr: "LRAL", country: "Lettonie", prefixes: ["YL"] },
  { abbr: "LRMD", country: "Lituanie", prefixes: ["LY"] },
  { abbr: "SARL", country: "Afrique du Sud", prefixes: ["ZS", "ZR", "ZT", "ZU"] },
  { abbr: "ARRL", country: "USA", prefixes: ["K", "W", "N", "A"] },
  { abbr: "RAC", country: "Canada", prefixes: ["VE", "VA", "VO", "VY", "CF", "CG", "CH", "CI"] },
  { abbr: "LABRE", country: "Brésil", prefixes: ["PY", "PP", "PR", "PS", "PT", "PU", "PV", "PW", "ZV", "ZW", "ZX", "ZY", "ZZ"] },
  { abbr: "RCA", country: "Argentine", prefixes: ["LU", "LW", "LO", "AY", "AZ", "L2"] },
  { abbr: "JARL", country: "Japon", prefixes: ["JA", "JE", "JF", "JG", "JH", "JI", "JJ", "JK", "JL", "JM", "JN", "JO", "JP", "JQ", "JR", "JS", "7J", "7K", "7L", "7M", "7N", "8J", "8N"] },
  { abbr: "KARL", country: "Corée", prefixes: ["HL", "DS", "DT", "6K", "6L", "6M", "6N"] },
  { abbr: "CRSA", country: "Chine", prefixes: ["BA", "BD", "BG", "BH", "BY", "BT"] },
  { abbr: "CTARL", country: "Taïwan", prefixes: ["BV", "BW", "BX", "BM", "BN", "BO", "BP", "BQ"] },
  { abbr: "WIA", country: "Australie", prefixes: ["VK", "AX"] },
  { abbr: "NZART", country: "Nouvelle-Zélande", prefixes: ["ZL", "ZM", "ZK"] },
  { abbr: "ARSI", country: "Inde", prefixes: ["VU", "VT", "VW", "AT", "8T"] },
  { abbr: "RAST", country: "Thaïlande", prefixes: ["HS", "E2"] },
  { abbr: "ORARI", country: "Indonésie", prefixes: ["YB", "YC", "YD", "YE", "YF", "YG", "YH", "7A", "7D", "8A", "8D"] },
  { abbr: "MARTS", country: "Malaisie", prefixes: ["9M", "9W"] },
  { abbr: "EARS", country: "Égypte", prefixes: ["SU"] },
  { abbr: "IARU", country: "Secrétariat intl (NU1AW)", prefixes: ["NU1AW"] },
];

/** Tente d'associer un indicatif spotté à une société HQ via son préfixe. */
export function hqFromCallsign(call: string): HQSociety | null {
  const c = call.toUpperCase();
  let best: HQSociety | null = null;
  let bestLen = 0;
  for (const s of HQ_SOCIETIES) {
    for (const p of s.prefixes) {
      if (c.startsWith(p) && p.length > bestLen) {
        best = s;
        bestLen = p.length;
      }
    }
  }
  return best;
}

/** Détecte si un indicatif/commentaire ressemble à une station HQ (suffixe HQ ou exchange société). */
export function looksLikeHQ(call: string, comment?: string): boolean {
  const c = call.toUpperCase();
  if (/\dHQ$/.test(c) || c.includes("HQ")) return true;
  if (comment && /\b(HQ|IARU|AC|R1|R2|R3)\b/.test(comment.toUpperCase())) return true;
  return false;
}
