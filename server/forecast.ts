/**
 * Module de prévision propagation 40 m à 7 jours.
 *
 * Croise 3 sources NOAA :
 * 1. 27-day outlook (SFI + A + Kp prévus jour par jour)
 * 2. Kp forecast 3h (précision horaire J+0 à J+2)
 * 3. 3-day forecast texte (probabilités éruptions, blackouts)
 *
 * Calcule un score de propagation 40 m par zone et par créneau horaire
 * (4 créneaux : 00-06, 06-12, 12-18, 18-24 UTC) pour chaque jour.
 */

import { CALIB_ZONES, CalibZone, predictScore, SolarInputs } from "./calibration";
import { getFt8HistoryForHour } from "./db";
import { blendNoaaFt8Score, scoreFt8History } from "./ft8Predictor";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DayForecast {
  date: string; // YYYY-MM-DD
  sfi: number;
  aIndex: number;
  kpMax: number;
  kpSlots: number[]; // Kp par créneau 3h (8 valeurs si dispo, sinon kpMax répété)
  flareProb: { c: number; m: number; x: number }; // probabilités %
  blackoutProb: { r1r2: number; r3plus: number }; // probabilités %
}

export interface ZoneDayScore {
  zoneId: string;
  label: string;
  scores: number[]; // 4 scores (un par créneau 6h)
  avg: number; // moyenne du jour
  peak: number; // meilleur créneau
  peakSlot: number; // index du meilleur créneau (0-3)
  risk: string; // "low" | "medium" | "high" (risque de perturbation)
  ft8Confidence: number; // confiance moyenne 0-100 de la composante observée
}

export interface Forecast7dResult {
  fetchedAt: number;
  days: Array<{
    date: string;
    sfi: number;
    aIndex: number;
    kpMax: number;
    flareProb: { c: number; m: number; x: number };
    blackoutProb: { r1r2: number; r3plus: number };
    globalScore: number; // score moyen toutes zones
      verdict: string; // "Excellent" | "Bon" | "Moyen" | "Dégradé" | "Mauvais"
      model: "NOAA+FT8";
      ft8Confidence: number;
      zones: ZoneDayScore[];
  }>;
}

// ─── Fetch NOAA ────────────────────────────────────────────────────────────

const OUTLOOK_URL = "https://services.swpc.noaa.gov/text/27-day-outlook.txt";
const KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
const THREE_DAY_URL = "https://services.swpc.noaa.gov/text/3-day-forecast.txt";

async function fetch27DayOutlook(): Promise<DayForecast[]> {
  const res = await fetch(OUTLOOK_URL, { signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  const lines = text.split("\n");
  const days: DayForecast[] = [];

  for (const line of lines) {
    // Format: "2026 Jul 05     160           5          2"
    const m = line.match(/^(\d{4})\s+(\w{3})\s+(\d{2})\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!m) continue;
    const [, year, mon, day, sfi, a, kp] = m;
    const monthMap: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const date = `${year}-${monthMap[mon]}-${day}`;
    days.push({
      date,
      sfi: Number(sfi),
      aIndex: Number(a),
      kpMax: Number(kp),
      kpSlots: Array(8).fill(Number(kp)),
      flareProb: { c: 0, m: 0, x: 0 },
      blackoutProb: { r1r2: 0, r3plus: 0 },
    });
  }
  return days;
}

interface KpEntry {
  time_tag: string;
  kp: number;
  observed: string;
}

async function fetchKpForecast3h(): Promise<Map<string, number[]>> {
  const res = await fetch(KP_FORECAST_URL, { signal: AbortSignal.timeout(10000) });
  const data: KpEntry[] = await res.json();
  // Grouper par date les entrées forecast
  const byDate = new Map<string, number[]>();
  for (const entry of data) {
    if (entry.observed === "observed") continue;
    const date = entry.time_tag.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(entry.kp);
  }
  return byDate;
}

async function fetch3DayForecast(): Promise<Map<string, { flare: { c: number; m: number; x: number }; blackout: { r1r2: number; r3plus: number } }>> {
  const res = await fetch(THREE_DAY_URL, { signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  const result = new Map<string, { flare: { c: number; m: number; x: number }; blackout: { r1r2: number; r3plus: number } }>();

  // Extraire les 3 dates du tableau Kp (ligne "             Jul 05       Jul 06       Jul 07")
  // On cherche la ligne qui commence par des espaces suivies de 3 dates "Mon DD"
  const dateLineMatch = text.match(/^\s{5,}(\w{3}\s+\d{2})\s+(\w{3}\s+\d{2})\s+(\w{3}\s+\d{2})\s*$/m);
  const dates: string[] = [];
  if (dateLineMatch) {
    const year = new Date().getUTCFullYear();
    const monthMap: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    for (let i = 1; i <= 3; i++) {
      const [mon, day] = dateLineMatch[i].trim().split(/\s+/);
      dates.push(`${year}-${monthMap[mon]}-${day.padStart(2, "0")}`);
    }
  }

  // Extraire probabilités de blackout radio
  const blackoutSection = text.match(/Radio Blackout Forecast[\s\S]*?R1-R2\s+([\d%]+)\s+([\d%]+)\s+([\d%]+)\s*\n\s*R3 or greater\s+([\d%]+)\s+([\d%]+)\s+([\d%]+)/);
  // Extraire probabilités d'éruptions solaires (pas directement dans ce format, on estime depuis les blackouts)
  // Les blackouts R1-R2 correspondent à des éruptions M, R3+ à des éruptions X

  for (let i = 0; i < dates.length; i++) {
    const r1r2 = blackoutSection ? (parseInt(blackoutSection[1 + i]) || 0) : 0;
    const r3plus = blackoutSection ? (parseInt(blackoutSection[4 + i]) || 0) : 0;
    // Estimation probabilités éruptions depuis blackouts (R1-R2 ≈ M-class, R3+ ≈ X-class)
    result.set(dates[i], {
      flare: { c: Math.min(99, r1r2 + 30), m: r1r2, x: r3plus },
      blackout: { r1r2, r3plus },
    });
  }

  return result;
}

// ─── Calcul du score de propagation 40 m ───────────────────────────────────

const SLOT_HOURS = [3, 9, 15, 21]; // heures centrales des 4 créneaux de 6h

function computeZoneDayScores(
  zone: CalibZone,
  date: string,
  dayForecast: DayForecast,
  qth?: { lat: number; lon: number },
): ZoneDayScore {
  const scores: number[] = [];

  for (const hour of SLOT_HOURS) {
    const dt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
    // Utiliser le Kp du créneau 3h correspondant si disponible
    const slotIndex = Math.floor(hour / 3);
    const kp = dayForecast.kpSlots[slotIndex] ?? dayForecast.kpMax;

    // Estimer le blackout : si probabilité R3+ > 30%, on simule R1 ; sinon R0
    const blackout = dayForecast.blackoutProb.r3plus >= 30
      ? "R2"
      : dayForecast.blackoutProb.r1r2 >= 60
        ? "R1"
        : "R0";

    const solar: SolarInputs = {
      kp,
      sfi: dayForecast.sfi,
      blackout,
    };

    scores.push(predictScore(zone, dt, solar, "40m", qth));
  }

  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const peak = Math.max(...scores);
  const peakSlot = scores.indexOf(peak);

  // Évaluation du risque basée sur Kp et probabilités
  let risk: "low" | "medium" | "high" = "low";
  if (dayForecast.kpMax >= 5 || dayForecast.blackoutProb.r3plus >= 30) risk = "high";
  else if (dayForecast.kpMax >= 3 || dayForecast.blackoutProb.r1r2 >= 60) risk = "medium";

  return {
    zoneId: zone.id,
    label: zone.label,
    scores,
    avg,
    peak,
    peakSlot,
    risk,
    ft8Confidence: 0,
  };
}

const ZONE_TO_CONTINENT: Record<string, string> = {
  eu_e: "EU", scand: "EU",
  me: "AS", ua9: "AS", vu: "AS", ja: "AS", sea: "AS",
  us_e: "NA", us_w: "NA", carib: "NA",
  zs: "AF", py: "SA", vk: "OC", zl: "OC",
};

function verdict(score: number): string {
  if (score >= 70) return "Excellent";
  if (score >= 55) return "Bon";
  if (score >= 40) return "Moyen";
  if (score >= 25) return "Dégradé";
  return "Mauvais";
}

// ─── API publique ──────────────────────────────────────────────────────────

export async function computeForecast7d(qth?: { lat: number; lon: number }): Promise<Forecast7dResult> {
  // 1. Récupérer les 3 sources en parallèle
  const [outlook, kp3h, threeDay] = await Promise.all([
    fetch27DayOutlook(),
    fetchKpForecast3h(),
    fetch3DayForecast(),
  ]);

  // 2. Filtrer les 7 prochains jours à partir d'aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  const next7 = outlook.filter((d) => d.date >= today).slice(0, 7);

  // Si moins de 7 jours dans l'outlook, compléter avec les derniers disponibles
  while (next7.length < 7 && outlook.length > 0) {
    const last = outlook[outlook.length - 1];
    const nextDate = new Date(last.date);
    nextDate.setDate(nextDate.getDate() + 1);
    next7.push({
      ...last,
      date: nextDate.toISOString().slice(0, 10),
    });
  }

  // 3. Enrichir avec Kp 3h et probabilités éruptions
  for (const day of next7) {
    // Kp 3h détaillé (si disponible)
    const kpDetail = kp3h.get(day.date);
    if (kpDetail && kpDetail.length >= 4) {
      day.kpSlots = kpDetail;
      day.kpMax = Math.max(...kpDetail);
    }

    // Probabilités éruptions/blackouts (3-day forecast)
    const probs = threeDay.get(day.date);
    if (probs) {
      day.flareProb = probs.flare;
      day.blackoutProb = probs.blackout;
    } else {
      // Estimation par défaut basée sur le SFI
      day.flareProb = {
        c: day.sfi >= 150 ? 90 : day.sfi >= 120 ? 70 : 50,
        m: day.sfi >= 150 ? 50 : day.sfi >= 120 ? 30 : 15,
        x: day.sfi >= 150 ? 15 : day.sfi >= 120 ? 8 : 3,
      };
      day.blackoutProb = { r1r2: day.flareProb.m, r3plus: day.flareProb.x };
    }
  }

  // 4. Charger une seule fois l'historique FT8 des quatre créneaux.
  const ft8HistoryByHour = new Map<number, Awaited<ReturnType<typeof getFt8HistoryForHour>>>();
  await Promise.all(SLOT_HOURS.map(async (hour) => {
    ft8HistoryByHour.set(hour, await getFt8HistoryForHour(hour, "40m"));
  }));

  // 5. Calculer les scores par zone et par jour, puis les fusionner avec les mesures FT8.
  const days = next7.map((day) => {
    const zones = CALIB_ZONES.map((z) => {
      const zone = computeZoneDayScores(z, day.date, day, qth);
      const continent = ZONE_TO_CONTINENT[z.id];
      if (!continent) return zone;

      const confidences: number[] = [];
      zone.scores = zone.scores.map((noaaScore, slotIndex) => {
        const hour = SLOT_HOURS[slotIndex];
        const kpIndex = Math.floor(hour / 3);
        const kp = day.kpSlots[kpIndex] ?? day.kpMax;
        const observed = scoreFt8History(ft8HistoryByHour.get(hour) ?? [], continent, day.sfi, kp);
        confidences.push(observed.confidence);
        return blendNoaaFt8Score(noaaScore, observed.score, observed.confidence);
      });
      zone.avg = Math.round(zone.scores.reduce((sum, score) => sum + score, 0) / zone.scores.length);
      zone.peak = Math.max(...zone.scores);
      zone.peakSlot = zone.scores.indexOf(zone.peak);
      zone.ft8Confidence = Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 100);
      return zone;
    });
    const globalScore = Math.round(zones.reduce((sum, z) => sum + z.avg, 0) / zones.length);
    const ft8Confidence = Math.round(zones.reduce((sum, z) => sum + z.ft8Confidence, 0) / zones.length);
    return {
      date: day.date,
      sfi: day.sfi,
      aIndex: day.aIndex,
      kpMax: day.kpMax,
      flareProb: day.flareProb,
      blackoutProb: day.blackoutProb,
      globalScore,
      verdict: verdict(globalScore),
      model: "NOAA+FT8" as const,
      ft8Confidence,
      zones,
    };
  });

  return { fetchedAt: Date.now(), days };
}

/** Créneau horaire label */
export const SLOT_LABELS = ["00–06 UTC", "06–12 UTC", "12–18 UTC", "18–24 UTC"];
