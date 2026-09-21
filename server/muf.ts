/**
 * MUF (Maximum Usable Frequency) calculator via GIRO DIDBase ionosondes.
 * Fetches foF2 and hmF2 from Dourbes (DB049) and Rome (RO041).
 *
 * Calcul correct :
 *   MUF(3000) = foF2 × M(3000)F2
 * où M(3000)F2 est estimé à partir de hmF2 via la formule de Shimazaki (1955) :
 *   M(3000)F2 ≈ 1490 / (hmF2 + ΔM) - 0.176
 * avec ΔM ≈ 176 km (approximation standard pour absence de couche F1 en soirée).
 *
 * Robustesse :
 * - Utilise la MÉDIANE des lectures récentes (pas la dernière valeur)
 * - Filtre les valeurs aberrantes (> 2× écart interquartile)
 * - Seuil de confiance CS ≥ 70
 */

const GIRO_BASE = "https://lgdc.uml.edu/fastchar/getbest";

interface StationReading {
  station: string;
  ursiCode: string;
  foF2: number | null;
  hmF2: number | null;
  timestamp: string | null;
  confidence: number | null;
  sampleCount: number;
}

export interface MufResult {
  dourbes: StationReading;
  rome: StationReading;
  averageFoF2: number | null;
  averageHmF2: number | null;
  mFactor: number | null;
  muf: number | null;
  method: string;
  fetchedAt: string;
}

// Cache: refresh every 5 minutes
let cache: MufResult | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Minimum confidence score
const MIN_CS = 70;

/**
 * Parse GIRO FastChar text response to extract all valid readings.
 */
export function parseGiroResponse(text: string, minCS = MIN_CS): { values: number[]; timestamps: string[] } {
  const lines = text.split("\n").filter((l) => !l.startsWith("#") && l.trim().length > 0);
  const values: number[] = [];
  const timestamps: string[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const timestamp = parts[0];
    const cs = parseInt(parts[1], 10);
    const value = parseFloat(parts[2]);

    if (isNaN(cs) || isNaN(value)) continue;
    if (cs < minCS) continue;

    values.push(value);
    timestamps.push(timestamp);
  }

  return { values, timestamps };
}

/**
 * Calcule la médiane d'un tableau de nombres.
 */
export function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Filtre les valeurs aberrantes.
 * - Pour ≥ 4 valeurs : méthode IQR (Q1-1.5×IQR, Q3+1.5×IQR)
 * - Pour 2-3 valeurs : si l'écart max/min > 50%, exclut la valeur la plus éloignée de la médiane
 * - Pour 1 valeur : retourne telle quelle
 */
export function filterOutliers(arr: number[]): number[] {
  if (arr.length <= 1) return arr;

  if (arr.length < 4) {
    // Petits échantillons : vérifier la cohérence
    const sorted = [...arr].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    // Si l'écart max/min > 50%, c'est suspect
    if (min > 0 && (max - min) / min > 0.5) {
      // Exclure la valeur la plus éloignée de la médiane
      const med = sorted.length === 2 ? sorted[0] : sorted[1]; // pour 2 valeurs, prendre la plus basse (conservateur)
      return arr.filter((v) => Math.abs(v - med) / med <= 0.3);
    }
    return arr;
  }

  // ≥ 4 valeurs : méthode IQR standard
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return arr.filter((v) => v >= lower && v <= upper);
}

/**
 * Calcule M(3000)F2 à partir de hmF2 via la formule de Shimazaki.
 * M(3000)F2 ≈ 1490 / (hmF2 + ΔM) - 0.176
 * ΔM = 176 km (approximation standard sans couche F1 active)
 */
export function computeMFactor(hmF2: number): number {
  // Formule de Shimazaki (1955) simplifiée
  const deltaM = 176; // km, correction pour absence de F1
  const m = 1490 / (hmF2 + deltaM) - 0.176;
  // Clamp entre 2.0 et 4.0 (valeurs physiquement raisonnables)
  return Math.max(2.0, Math.min(4.0, m));
}

async function fetchCharacteristic(
  ursiCode: string,
  charName: string
): Promise<{ values: number[]; timestamps: string[] }> {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const fromDate = twoHoursAgo.toISOString().replace("T", " ").substring(0, 16).replace(/-/g, "/");
    const toDate = now.toISOString().replace("T", " ").substring(0, 16).replace(/-/g, "/");

    const url = `${GIRO_BASE}?ursiCode=${ursiCode}&charName=${charName}&DMUF=3000&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!resp.ok) {
      console.warn(`[MUF] GIRO fetch failed for ${ursiCode}/${charName}: ${resp.status}`);
      return { values: [], timestamps: [] };
    }

    const text = await resp.text();
    return parseGiroResponse(text);
  } catch (err) {
    console.warn(`[MUF] Error fetching ${ursiCode}/${charName}:`, err);
    return { values: [], timestamps: [] };
  }
}

async function fetchStationData(ursiCode: string, stationName: string): Promise<StationReading> {
  const [foF2Data, hmF2Data] = await Promise.all([
    fetchCharacteristic(ursiCode, "foF2"),
    fetchCharacteristic(ursiCode, "hmF2"),
  ]);

  // Filtrer les aberrants et prendre la médiane
  const foF2Filtered = filterOutliers(foF2Data.values);
  const hmF2Filtered = filterOutliers(hmF2Data.values);

  const foF2 = median(foF2Filtered);
  const hmF2 = median(hmF2Filtered);

  const lastTimestamp = foF2Data.timestamps.length > 0
    ? foF2Data.timestamps[foF2Data.timestamps.length - 1]
    : null;

  return {
    station: stationName,
    ursiCode,
    foF2,
    hmF2,
    timestamp: lastTimestamp,
    confidence: MIN_CS, // minimum threshold used
    sampleCount: foF2Filtered.length,
  };
}

export async function getMuf(): Promise<MufResult> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  const [dourbes, rome] = await Promise.all([
    fetchStationData("DB049", "Dourbes"),
    fetchStationData("RO041", "Rome"),
  ]);

  let averageFoF2: number | null = null;
  let averageHmF2: number | null = null;
  let mFactor: number | null = null;
  let muf: number | null = null;
  let method = "indisponible";

  // Calculer la moyenne foF2
  if (dourbes.foF2 !== null && rome.foF2 !== null) {
    averageFoF2 = (dourbes.foF2 + rome.foF2) / 2;
  } else if (dourbes.foF2 !== null) {
    averageFoF2 = dourbes.foF2;
  } else if (rome.foF2 !== null) {
    averageFoF2 = rome.foF2;
  }

  // Calculer la moyenne hmF2 et le facteur M
  if (dourbes.hmF2 !== null && rome.hmF2 !== null) {
    averageHmF2 = (dourbes.hmF2 + rome.hmF2) / 2;
  } else if (dourbes.hmF2 !== null) {
    averageHmF2 = dourbes.hmF2;
  } else if (rome.hmF2 !== null) {
    averageHmF2 = rome.hmF2;
  }

  if (averageHmF2 !== null) {
    mFactor = computeMFactor(averageHmF2);
    method = `Shimazaki (hmF2=${averageHmF2.toFixed(0)} km → M=${mFactor.toFixed(2)})`;
  } else {
    // Fallback: facteur M standard pour distances moyennes Europe (~2500 km)
    mFactor = 2.8;
    method = "facteur M=2.8 (fallback, hmF2 indisponible)";
  }

  // Calculer la MUF
  if (averageFoF2 !== null && mFactor !== null) {
    muf = Math.round(averageFoF2 * mFactor * 10) / 10;
  }

  const result: MufResult = {
    dourbes,
    rome,
    averageFoF2,
    averageHmF2,
    mFactor,
    muf,
    method,
    fetchedAt: new Date().toISOString(),
  };

  cache = result;
  cacheTime = now;

  return result;
}
