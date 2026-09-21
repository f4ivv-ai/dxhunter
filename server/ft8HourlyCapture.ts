/**
 * FT8 Quarter-Hour Capture — Agrège les spots FT8 (SNR >= -8 dB) par bande × continent
 * et enregistre un snapshot toutes les 15 minutes pour calibrer le modèle de propagation.
 *
 * Seuil -8 dB = signal exploitable en SSB (ouverture confirmée).
 * Calcule l'azimut dominant depuis le QTH de référence vers chaque continent.
 */

import { saveFt8HourlySnapshots } from "./db";
import { InsertPropagationFt8Hourly } from "../drizzle/schema";
import {
  _getSpots,
  selectPropagationSpotsForCapture,
  type FT8Spot,
  type PropagationCaptureSource,
} from "./pskreporter";
import { PRIMARY_KIWI } from "../shared/primaryKiwi";

// ─── Configuration ──────────────────────────────────────────────────────────

const SNR_THRESHOLD_SSB = -8; // dB minimum pour considérer exploitable en SSB
const CONTEST_BANDS = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
const CONTINENTS = ["EU", "NA", "SA", "AF", "AS", "OC"] as const;

/** Position exacte du récepteur prioritaire de Marcilloles. */
const QTH = { lat: PRIMARY_KIWI.lat, lon: PRIMARY_KIWI.lon };

/** Centres géographiques des continents pour calcul d'azimut */
const CONTINENT_CENTERS: Record<string, { lat: number; lon: number }> = {
  EU: { lat: 50.0, lon: 15.0 },
  NA: { lat: 40.0, lon: -100.0 },
  SA: { lat: -15.0, lon: -55.0 },
  AF: { lat: 5.0, lon: 25.0 },
  AS: { lat: 35.0, lon: 90.0 },
  OC: { lat: -25.0, lon: 135.0 },
};

// ─── Utilitaires ────────────────────────────────────────────────────────────

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

/** Calcule l'azimut (bearing) depuis QTH vers un point. */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const x = Math.sin(dl) * Math.cos(p2);
  const y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/** Locator Maidenhead → continent (simplifié). */
function locatorToContinent(grid: string): string {
  if (!grid || grid.length < 2) return "??";
  const lon = (grid.charCodeAt(0) - 65) * 20 - 180 + (grid.length >= 3 ? parseInt(grid[2], 10) * 2 : 10);
  const lat = (grid.charCodeAt(1) - 65) * 10 - 90 + (grid.length >= 4 ? parseInt(grid[3], 10) : 5);

  if (lat > 60 && lon > -30 && lon < 60) return "EU";
  if (lat >= 35 && lat <= 72 && lon >= -30 && lon <= 60) return "EU";
  if (lat >= 15 && lat <= 72 && lon >= -170 && lon <= -50) return "NA";
  if (lat >= -60 && lat < 15 && lon >= -90 && lon <= -30) return "SA";
  if (lat >= -40 && lat <= 35 && lon >= -20 && lon <= 55) return "AF";
  if (lat >= -10 && lat <= 72 && lon > 55 && lon <= 180) return "AS";
  if (lat >= -10 && lat <= 72 && lon >= -180 && lon <= -170) return "AS";
  if (lat < -10 && lon > 100) return "OC";
  if (lat >= -50 && lat < -10 && lon > 55 && lon <= 180) return "OC";
  return "??";
}

// ─── Interface avec PSKReporter en mémoire ──────────────────────────────────

/**
 * Accède aux spots FT8 bruts en mémoire depuis le module pskreporter.
 */
async function getRawFt8Spots(): Promise<FT8Spot[]> {
  return _getSpots();
}

// ─── Capture principale ─────────────────────────────────────────────────────

export interface Ft8HourlyCaptureResult {
  saved: number;
  totalSpots: number;
  at: string;
  bands: Record<string, number>;
  receiverSource: PropagationCaptureSource;
  primaryReceiverSpots: number;
  regionalSpots: number;
}

/**
 * Capture un snapshot FT8 par quart d'heure : agrège les spots en mémoire (SNR >= -8)
 * par bande × continent, calcule l'azimut dominant, et persiste en base.
 */
export async function captureFt8Hourly(
  source: "auto" | "manual" = "auto",
  solarData?: { sfi?: number; kp?: number },
): Promise<Ft8HourlyCaptureResult> {
  const now = new Date();
  const snapDate = now.toISOString().slice(0, 10);
  const hourUtc = now.getUTCHours();
  const minuteUtc = Math.floor(now.getUTCMinutes() / 15) * 15;

  // Récupérer les spots bruts FT8 en mémoire
  const allSpots = await getRawFt8Spots();

  // Priorité : réceptions F4IVV, puis JN25, puis ITU 27, puis monde.
  // La sélection conserve une fenêtre de 20 min pour couvrir le quart d'heure
  // malgré un léger retard Heartbeat.
  const exploitableSpots = allSpots.filter((s) => s.snr >= SNR_THRESHOLD_SSB);
  const selected = selectPropagationSpotsForCapture(exploitableSpots);
  const validSpots = selected.spots;

  // Agrégation par bande × continent
  const rows: InsertPropagationFt8Hourly[] = [];
  const bandCounts: Record<string, number> = {};

  for (const band of CONTEST_BANDS) {
    const bandSpots = validSpots.filter((s) => s.band === band);
    bandCounts[band] = bandSpots.length;

    for (const continent of CONTINENTS) {
      const contSpots = bandSpots.filter((s) => s.txContinent === continent);
      // On persiste aussi les zéros : sans créneaux fermés, le modèle ne voyait
      // que les ouvertures et calculait mécaniquement des probabilités trop hautes.
      const avgSnr = contSpots.length > 0
        ? Math.round(contSpots.reduce((sum, s) => sum + s.snr, 0) / contSpots.length)
        : null;
      const maxSnr = contSpots.length > 0 ? Math.max(...contSpots.map((s) => s.snr)) : null;

      // Azimut depuis QTH vers le centre du continent
      const center = CONTINENT_CENTERS[continent];
      const az = center ? Math.round(bearing(QTH.lat, QTH.lon, center.lat, center.lon)) : null;

      rows.push({
        snapDate,
        hourUtc,
        minuteUtc,
        band,
        continent,
        spotCount: contSpots.length,
        avgSnr,
        maxSnr,
        dominantAzimuth: az,
        sfi: solarData?.sfi ?? null,
        kp: solarData?.kp ?? null,
        receiverSource: selected.source,
        receiverCall: selected.source === "F4IVV" ? PRIMARY_KIWI.callsign : null,
        source,
      });
    }
  }

  // Persister en base
  const { saved } = await saveFt8HourlySnapshots(rows);

  console.log(
    `[FT8Quarter] Capture ${source}/${selected.source} : ${validSpots.length} spots (SNR>=-8), ${saved} lignes sauvées (${snapDate} ${hourUtc}:${String(minuteUtc).padStart(2, "0")} UTC)`,
  );

  return {
    saved,
    totalSpots: validSpots.length,
    at: `${snapDate} ${String(hourUtc).padStart(2, "0")}:${String(minuteUtc).padStart(2, "0")} UTC`,
    bands: bandCounts,
    receiverSource: selected.source,
    primaryReceiverSpots: selected.primaryCount,
    regionalSpots: selected.regionalCount,
  };
}

// ─── Exports pour tests ─────────────────────────────────────────────────────

export { SNR_THRESHOLD_SSB, CONTEST_BANDS, CONTINENTS, CONTINENT_CENTERS, bearing, locatorToContinent };
