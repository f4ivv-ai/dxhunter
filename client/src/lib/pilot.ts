/**
 * Logique de pilotage TM0HQ 40 m.
 * Combine le moteur de propagation, les spots 40 m live et le suivi des
 * multiplicateurs pour produire :
 *  - des recommandations d'azimut/zone "maintenant",
 *  - une timeline horaire couvrant tout le concours,
 *  - le statut des multiplicateurs (zones ITU + sociétés HQ).
 */
import { Spot } from "./dx";
import {
  ZONES,
  Zone,
  ZoneProp,
  evaluateAllZones,
  azToCardinal,
  SolarInputs,
} from "./propagation";

/** Normalise un Kp seul ou un objet SolarInputs en SolarInputs complet. */
function toSolar(s: SolarInputs | number | null): SolarInputs {
  if (s != null && typeof s === "object") return s;
  return { kp: typeof s === "number" ? s : null, sfi: null, flareClass: null, blackout: null };
}
import { HQ_SOCIETIES, hqFromCallsign, ituZoneFromLatLon, looksLikeHQ } from "./multipliers";

/** Fenêtre du concours IARU HF 2026 (UTC). */
export const CONTEST_START = new Date("2026-07-11T12:00:00Z");
export const CONTEST_END = new Date("2026-07-12T12:00:00Z");

export interface Recommendation {
  zone: Zone;
  prop: ZoneProp;
  /** spots 40m récents correspondant à cette zone (n) */
  liveSpots: number;
  /** priorité finale combinant propagation + présence de mult manquants + activité live */
  priority: number;
  /** rôle conseillé pour traiter cette zone */
  role: "RUN" | "MULT" | "IN-BAND" | "ÉCOUTE";
  note: string;
}

export interface MultStatus {
  ituZones: { zone: number; worked: boolean; spotted: boolean }[];
  hqWorked: Set<string>;
  hqSpotted: Set<string>;
  hqMissing: string[];
}

/** Calcule la zone ITU + société HQ d'un spot (pour suivi mult). */
export function spotMultInfo(s: Spot): { itu: number | null; hq: string | null } {
  const itu =
    s.dx_latitude != null && s.dx_longitude != null
      ? ituZoneFromLatLon(s.dx_latitude, s.dx_longitude)
      : null;
  const hqSoc = looksLikeHQ(s.dx_call, s.comment ?? undefined)
    ? hqFromCallsign(s.dx_call)
    : null;
  return { itu, hq: hqSoc?.abbr ?? null };
}

/**
 * Construit le statut des multiplicateurs à partir des spots 40 m et des
 * mults déjà "travaillés" (saisis par l'opérateur, persistés).
 */
export function buildMultStatus(
  spots40: Spot[],
  workedItu: Set<number>,
  workedHq: Set<string>
): MultStatus {
  const spottedItu = new Set<number>();
  const spottedHq = new Set<string>();
  for (const s of spots40) {
    const { itu, hq } = spotMultInfo(s);
    if (itu != null) spottedItu.add(itu);
    if (hq) spottedHq.add(hq);
  }
  // zones ITU pertinentes (large couverture) : 1..75 usuelles ; on suit celles vues + clés
  const keyZones = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
    28, 29, 30, 31, 32, 33, 37, 38, 39, 40, 41, 42, 43, 44, 45, 49, 50, 51, 54, 57, 58, 59, 60,
  ];
  const seen = new Set<number>([...keyZones, ...Array.from(spottedItu), ...Array.from(workedItu)]);
  const ituZones = Array.from(seen)
    .sort((a, b) => a - b)
    .map((zone) => ({
      zone,
      worked: workedItu.has(zone),
      spotted: spottedItu.has(zone),
    }));

  const hqMissing = HQ_SOCIETIES.map((h) => h.abbr).filter((a) => !workedHq.has(a));

  return { ituZones, hqWorked: workedHq, hqSpotted: spottedHq, hqMissing };
}

/**
 * Génère les recommandations "maintenant" : pour chaque zone, score de
 * propagation + bonus si des multiplicateurs y sont présents/manquants +
 * bonus d'activité live, puis attribution d'un rôle.
 */
export function buildRecommendations(
  spots40: Spot[],
  workedItu: Set<number>,
  workedHq: Set<string>,
  solar: SolarInputs | number | null,
  now: Date = new Date(),
  qth?: { lat: number; lon: number }
): Recommendation[] {
  const props = evaluateAllZones(now, toSolar(solar), qth);

  // compte les spots live par zone (rattachement par continent + distance grossière)
  const liveByZone = new Map<string, number>();
  for (const z of ZONES) liveByZone.set(z.id, 0);
  for (const s of spots40) {
    if (s.dx_latitude == null || s.dx_longitude == null) continue;
    // rattache le spot à la zone la plus proche
    let best: string | null = null;
    let bestD = Infinity;
    for (const z of ZONES) {
      const d = (z.lat - s.dx_latitude) ** 2 + (z.lon - s.dx_longitude) ** 2;
      if (d < bestD) {
        bestD = d;
        best = z.id;
      }
    }
    if (best && bestD < 900) liveByZone.set(best, (liveByZone.get(best) || 0) + 1);
  }

  const recs: Recommendation[] = props.map((prop) => {
    const live = liveByZone.get(prop.zone.id) || 0;
    let priority = prop.score;

    // bonus si la zone porte un multiplicateur ITU manquant
    const ituGuess = ituZoneFromLatLon(prop.zone.lat, prop.zone.lon);
    if (ituGuess != null && !workedItu.has(ituGuess)) priority += 12;
    // bonus activité live (preuve d'ouverture réelle)
    if (live > 0) priority += Math.min(15, live * 3);

    // attribution de rôle
    let role: Recommendation["role"] = "MULT";
    let note = prop.reason;
    if (prop.qthState === "day" && prop.distance < 2500) {
      role = "RUN";
      note = "Run EU : volume de QSO";
    } else if (prop.score >= 55 && live >= 2) {
      role = "RUN";
      note = "Ouverture confirmée : run possible vers cette zone";
    } else if (prop.score >= 45 && live === 0) {
      role = "ÉCOUTE";
      note = "Devrait être ouvert : à confirmer au WebSDR avant d'engager";
    } else if (prop.path === "LP") {
      role = "MULT";
      note = "Tester en long path (cap " + Math.round(prop.lpAz) + "°)";
    }

    return { zone: prop.zone, prop, liveSpots: live, priority: Math.round(priority), role, note };
  });

  return recs.sort((a, b) => b.priority - a.priority);
}

export interface TimelineSlot {
  start: Date;
  hourUTC: number;
  /** zones recommandées triées par score à cette heure */
  zones: { label: string; az: number; cardinal: string; path: "SP" | "LP"; score: number }[];
  headline: string;
}

/**
 * Construit la timeline horaire du concours (24 créneaux) avec, pour chaque
 * heure, les meilleures zones à viser. Sert au plan prévisionnel et à la
 * fenêtre glissante "6 h avant".
 */
export function buildTimeline(solar: SolarInputs | number | null, qth?: { lat: number; lon: number }): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  const sin = toSolar(solar);
  for (let h = 0; h < 24; h++) {
    const start = new Date(CONTEST_START.getTime() + h * 3600_000);
    const props = evaluateAllZones(start, sin, qth).slice(0, 4);
    const zones = props.map((p) => ({
      label: p.zone.label,
      az: p.path === "LP" ? Math.round(p.lpAz) : Math.round(p.spAz),
      cardinal: azToCardinal(p.path === "LP" ? p.lpAz : p.spAz),
      path: p.path,
      score: p.score,
    }));
    const top = props[0];
    const headline =
      top.qthState === "day"
        ? "Jour : run EU + zones proches"
        : top.qthState === "grayline"
          ? `Grayline : pic vers ${top.zone.label}`
          : `Nuit : DX vers ${top.zone.label}`;
    slots.push({ start, hourUTC: start.getUTCHours(), zones, headline });
  }
  return slots;
}

/** Détermine la prochaine fenêtre "6 h avant" pertinente par rapport à maintenant. */
export function rollingWindow(now: Date = new Date()): { from: Date; to: Date; label: string } {
  // Si avant le concours : compte à rebours par paliers ; sinon fenêtre live -> +6h
  if (now < CONTEST_START) {
    const hoursTo = (CONTEST_START.getTime() - now.getTime()) / 3600_000;
    const palier = hoursTo > 24 ? "J-24h" : hoursTo > 12 ? "J-12h" : hoursTo > 6 ? "J-6h" : "J-1h";
    return { from: now, to: CONTEST_START, label: `Préparation ${palier}` };
  }
  const to = new Date(Math.min(now.getTime() + 6 * 3600_000, CONTEST_END.getTime()));
  return { from: now, to, label: "Fenêtre live +6 h" };
}
