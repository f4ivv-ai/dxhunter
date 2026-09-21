/**
 * Capture de calibration partagée entre la procédure tRPC (déclenchement manuel)
 * et le handler Heartbeat (déclenchement quotidien automatique).
 *
 * Récupère les spots TOUTES BANDES réels + la météo solaire NOAA, calcule les
 * snapshots via le modèle multi-bandes, puis les enregistre (upsert idempotent).
 */
import { buildSnapshot, RawSpot, SnapshotRow, ALL_CONTEST_BANDS } from "./calibration";
import { saveCalibrationSnapshots } from "./db";

const SPOTHOLE = "https://spothole.app/api/v1";
const NOAA = "https://services.swpc.noaa.gov";

async function fetchJson(url: string, ms: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function blackoutFromFlare(cls: string | null): string | null {
  if (!cls) return null;
  const letter = cls[0]?.toUpperCase();
  const mag = parseFloat(cls.slice(1)) || 0;
  if (letter === "X") return mag >= 10 ? "R4" : "R3";
  if (letter === "M") return mag >= 5 ? "R2" : "R1";
  return "R0";
}

/** Récupère les spots HF récents sur TOUTES les bandes contest (fenêtre 30 min). */
async function fetchAllBandSpots(): Promise<RawSpot[]> {
  const allSpots: RawSpot[] = [];
  // Fetch en parallèle pour les 6 bandes
  const results = await Promise.allSettled(
    ALL_CONTEST_BANDS.map(async (band) => {
      try {
        const url = `${SPOTHOLE}/spots?band=${band}&source=Cluster,RBN&max_age=1800&limit=500`;
        const data = (await fetchJson(url, 15000)) as RawSpot[];
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error(`[calibration] erreur spots ${band}:`, e);
        return [];
      }
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") allSpots.push(...r.value);
  }
  return allSpots;
}

/** Récupère Kp / SFI / black-out NOAA (best effort, valeurs nullables). */
async function fetchSolar(): Promise<{ kp: number | null; sfi: number | null; aIndex: number | null; blackout: string | null }> {
  let kp: number | null = null;
  let sfi: number | null = null;
  let aIndex: number | null = null;
  let blackout: string | null = null;
  try {
    const k = (await fetchJson(`${NOAA}/json/planetary_k_index_1m.json`, 8000)) as Array<{
      kp_index: number;
      estimated_kp: number;
    }>;
    if (Array.isArray(k) && k.length) {
      const last = k[k.length - 1];
      kp = Number(last.estimated_kp ?? last.kp_index);
    }
  } catch {
    /* noop */
  }
  try {
    const f = (await fetchJson(`${NOAA}/json/f107_cm_flux.json`, 8000)) as Array<{ flux: number }>;
    if (Array.isArray(f) && f.length) sfi = Math.round(Number(f[f.length - 1].flux));
  } catch {
    /* noop */
  }
  try {
    const fl = (await fetchJson(`${NOAA}/json/goes/primary/xray-flares-latest.json`, 8000)) as Array<{
      max_class: string;
    }>;
    if (Array.isArray(fl) && fl.length) blackout = blackoutFromFlare(fl[0].max_class);
  } catch {
    /* noop */
  }
  // A planétaire approximé depuis Kp si non disponible directement
  if (kp != null) {
    const table = [0, 2, 3, 4, 5, 6, 7, 9, 12, 15, 18, 22, 27, 32, 39, 48, 56, 67, 80, 94, 111, 132, 154, 179, 207, 236, 300, 400];
    aIndex = table[Math.max(0, Math.min(table.length - 1, Math.round(kp * 3)))];
  }
  return { kp, sfi, aIndex, blackout };
}

export interface CaptureResult {
  saved: number;
  rows: SnapshotRow[];
  solar: { kp: number | null; sfi: number | null; aIndex: number | null; blackout: string | null };
  spotCount: number;
  bandCounts: Record<string, number>;
  at: number;
}

/** Exécute une capture complète multi-bandes et l'enregistre. */
export async function captureCalibration(
  source: "auto" | "manual",
  now: Date = new Date(),
): Promise<CaptureResult> {
  const [spots, solar] = await Promise.all([fetchAllBandSpots(), fetchSolar()]);

  // Compter les spots par bande pour le diagnostic
  const bandCounts: Record<string, number> = {};
  for (const b of ALL_CONTEST_BANDS) bandCounts[b] = 0;
  for (const s of spots) {
    if (s.band && bandCounts[s.band] !== undefined) bandCounts[s.band]++;
  }

  const rows = buildSnapshot(spots, solar, now, source);
  const saved = await saveCalibrationSnapshots(
    rows.map((r) => ({
      snapDate: r.snapDate,
      hourUtc: r.hourUtc,
      band: r.band,
      zoneId: r.zoneId,
      zoneLabel: r.zoneLabel,
      predictedScore: r.predictedScore,
      actualSpots: r.actualSpots,
      actualScore: r.actualScore,
      error: r.error,
      kp: r.kp,
      sfi: r.sfi,
      aIndex: r.aIndex,
      source: r.source,
    })),
  );
  return { saved, rows, solar, spotCount: spots.length, bandCounts, at: now.getTime() };
}
