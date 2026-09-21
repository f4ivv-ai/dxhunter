/**
 * FT8 Predictor — Moteur de prédiction amélioré basé sur l'historique FT8 réel.
 *
 * Remplace la probabilité brute (count/30) par un score pondéré qui intègre :
 * 1. Pondération temporelle : les jours récents pèsent plus (décroissance exponentielle)
 * 2. Pondération par conditions solaires : SFI/Kp similaires au moment actuel
 * 3. Score SNR : force de l'ouverture (SNR moyen)
 * 4. Tendance : amélioration ou dégradation sur les dernières heures
 *
 * Objectif : passer de 15-20% de précision à 65-70%.
 */

import { getFt8HistoryForHour, listFt8HourlySnapshots } from "./db";
import type { PropagationFt8Hourly } from "../drizzle/schema";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Ft8Prediction {
  band: string;
  continent: string;
  /** Score de probabilité 0-100 (pondéré) */
  probability: number;
  /** Confiance dans la prédiction (0-100) basée sur le nombre d'échantillons */
  confidence: number;
  /** SNR moyen attendu (basé sur l'historique) */
  expectedSnr: number;
  /** Tendance : "rising" | "stable" | "falling" */
  trend: "rising" | "stable" | "falling";
  /** Nombre de jours d'historique utilisés */
  sampleDays: number;
}

export interface Ft8PredictionResult {
  predictions: Ft8Prediction[];
  currentHourScore: number; // score global de propagation actuel (0-100)
  nextHourScore: number; // score prévu pour l'heure suivante
  modelInfo: {
    totalSamples: number;
    daysOfData: number;
    sfiUsed: number | null;
    kpUsed: number | null;
  };
}

// ─── Configuration ─────────────────────────────────────────────────────────

/** Demi-vie de la pondération temporelle (en jours) */
const RECENCY_HALFLIFE_DAYS = 5;

/** Tolérance SFI pour considérer des conditions "similaires" */
const SFI_TOLERANCE = 20;

/** Tolérance Kp pour considérer des conditions "similaires" */
const KP_TOLERANCE = 1.5;

/** Poids bonus pour les jours avec conditions solaires similaires */
const SOLAR_MATCH_BONUS = 2.5;

/** Seuil minimum de spotCount pour considérer une ouverture */
const MIN_SPOT_COUNT = 1;

/** SNR minimum pour une ouverture exploitable en SSB */
const SNR_THRESHOLD_SSB = -8;

// ─── Utilitaires ───────────────────────────────────────────────────────────

function recencyWeight(ageDays: number): number {
  // Décroissance exponentielle : poids 1.0 aujourd'hui, 0.5 après HALFLIFE jours
  return Math.exp(-ageDays * Math.LN2 / RECENCY_HALFLIFE_DAYS);
}

function solarSimilarityWeight(
  historySfi: number | null,
  historyKp: number | null,
  currentSfi: number | null,
  currentKp: number | null,
): number {
  if (currentSfi == null && currentKp == null) return 1; // pas de données solaires → poids neutre

  let bonus = 1;

  if (currentSfi != null && historySfi != null) {
    const sfiDiff = Math.abs(currentSfi - historySfi);
    if (sfiDiff <= SFI_TOLERANCE) {
      bonus *= SOLAR_MATCH_BONUS * (1 - sfiDiff / (SFI_TOLERANCE * 2));
    }
  }

  if (currentKp != null && historyKp != null) {
    const kpDiff = Math.abs(currentKp - historyKp);
    if (kpDiff <= KP_TOLERANCE) {
      bonus *= 1 + (1 - kpDiff / KP_TOLERANCE);
    }
  }

  return bonus;
}

export function snrToScore(avgSnr: number): number {
  // Convertit un SNR moyen en score 0-100
  // -8 dB = seuil SSB = score 30
  // 0 dB = bon signal = score 60
  // +10 dB = excellent = score 90
  // +20 dB = exceptionnel = score 100
  if (avgSnr < SNR_THRESHOLD_SSB) return 0;
  if (avgSnr <= 0) return Math.round(30 + ((avgSnr + 8) / 8) * 30);
  if (avgSnr <= 10) return Math.round(60 + (avgSnr / 10) * 30);
  return Math.round(Math.min(100, 90 + ((avgSnr - 10) / 10) * 10));
}

// ─── Moteur de prédiction ──────────────────────────────────────────────────

/**
 * Calcule les prédictions FT8 améliorées pour l'heure suivante.
 * 
 * @param currentSfi - SFI actuel (optionnel, améliore la précision)
 * @param currentKp - Kp actuel (optionnel, améliore la précision)
 */
export async function computeFt8Predictions(
  currentSfi: number | null = null,
  currentKp: number | null = null,
): Promise<Ft8PredictionResult> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const nextHour = (currentHour + 1) % 24;
  const prevHour = (currentHour + 23) % 24;
  const today = now.toISOString().slice(0, 10);

  // Récupérer l'historique pour l'heure actuelle, précédente et suivante
  const [currentHistory, nextHistory, prevHistory] = await Promise.all([
    getFt8HistoryForHour(currentHour),
    getFt8HistoryForHour(nextHour),
    getFt8HistoryForHour(prevHour),
  ]);

  const bands = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
  const continents = ["EU", "NA", "SA", "AF", "AS", "OC"] as const;

  const predictions: Ft8Prediction[] = [];

  for (const band of bands) {
    for (const cont of continents) {
      const nextData = nextHistory.filter(
        (h) => h.band === band && h.continent === cont,
      );
      const currentData = currentHistory.filter(
        (h) => h.band === band && h.continent === cont,
      );
      const prevData = prevHistory.filter(
        (h) => h.band === band && h.continent === cont,
      );

      if (nextData.length < 2) continue; // pas assez de données

      // Calcul du score pondéré
      let weightedOpenScore = 0;
      let weightedSnrSum = 0;
      let totalWeight = 0;

      for (const row of nextData) {
        const ageDays = Math.max(
          0,
          Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(row.snapDate + "T00:00:00Z")) / 86400_000),
        );

        // Pondération temporelle (récence)
        const timeWeight = recencyWeight(ageDays);

        // Pondération par conditions solaires similaires
        const solarWeight = solarSimilarityWeight(
          row.sfi,
          row.kp,
          currentSfi,
          currentKp,
        );

        const combinedWeight = timeWeight * solarWeight;
        totalWeight += combinedWeight;

        // Score d'ouverture : 1 si ouvert (spotCount > 0 et SNR acceptable), 0 sinon
        if (row.spotCount >= MIN_SPOT_COUNT) {
          weightedOpenScore += combinedWeight;
          weightedSnrSum += (row.avgSnr ?? -10) * combinedWeight;
        }
      }

      if (totalWeight === 0) continue;

      // Probabilité pondérée (0-100)
      const rawProbability = (weightedOpenScore / totalWeight) * 100;

      // Calcul de la tendance basée sur l'heure précédente vs actuelle
      const prevOpenRate = prevData.length > 0
        ? prevData.filter((h) => h.spotCount >= MIN_SPOT_COUNT).length / prevData.length
        : 0;
      const currentOpenRate = currentData.length > 0
        ? currentData.filter((h) => h.spotCount >= MIN_SPOT_COUNT).length / currentData.length
        : 0;

      let trend: "rising" | "stable" | "falling" = "stable";
      const trendDiff = currentOpenRate - prevOpenRate;
      if (trendDiff > 0.15) trend = "rising";
      else if (trendDiff < -0.15) trend = "falling";

      // Ajustement par tendance
      let trendBonus = 0;
      if (trend === "rising") trendBonus = 10;
      else if (trend === "falling") trendBonus = -8;

      const probability = Math.max(0, Math.min(100, Math.round(rawProbability + trendBonus)));

      // SNR moyen attendu
      const expectedSnr = weightedOpenScore > 0
        ? Math.round(weightedSnrSum / weightedOpenScore)
        : -10;

      // Confiance basée sur la couverture réelle : 14 jours × 4 quarts d'heure.
      // Les anciennes données horaires ne peuvent donc pas donner une confiance excessive.
      const sampleDays = new Set(nextData.map((h) => h.snapDate)).size;
      const confidence = Math.min(100, Math.round((nextData.length / 56) * 100));

      if (probability >= 15) { // seuil minimum pour afficher une prédiction
        predictions.push({
          band,
          continent: cont,
          probability,
          confidence,
          expectedSnr,
          trend,
          sampleDays,
        });
      }
    }
  }

  // Trier par probabilité décroissante
  predictions.sort((a, b) => b.probability - a.probability);

  // Score global actuel et prévu
  const currentHourScore = computeGlobalScore(currentHistory);
  const nextHourScore = computeGlobalScore(nextHistory);

  // Nombre total de jours de données
  const allDates = new Set([
    ...currentHistory.map((h) => h.snapDate),
    ...nextHistory.map((h) => h.snapDate),
  ]);

  return {
    predictions: predictions.slice(0, 15), // top 15
    currentHourScore,
    nextHourScore,
    modelInfo: {
      totalSamples: currentHistory.length + nextHistory.length,
      daysOfData: allDates.size,
      sfiUsed: currentSfi,
      kpUsed: currentKp,
    },
  };
}

/**
 * Calcule un score global de propagation (0-100) à partir de l'historique d'une heure.
 */
function computeGlobalScore(history: PropagationFt8Hourly[]): number {
  if (history.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let weightedScore = 0;
  let totalWeight = 0;

  // Grouper par jour et calculer un score par jour
  const byDate = new Map<string, PropagationFt8Hourly[]>();
  for (const h of history) {
    const existing = byDate.get(h.snapDate) ?? [];
    existing.push(h);
    byDate.set(h.snapDate, existing);
  }

  for (const [date, rows] of byDate) {
    const ageDays = Math.max(
      0,
      Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(date + "T00:00:00Z")) / 86400_000),
    );
    const weight = recencyWeight(ageDays);

    // Score du jour : nombre de bandes × continents ouverts, pondéré par SNR
    const openPairs = rows.filter((r) => r.spotCount >= MIN_SPOT_COUNT);
    const dayScore = Math.min(100, openPairs.length * 8 + 
      openPairs.reduce((sum, r) => sum + snrToScore(r.avgSnr ?? -10), 0) / Math.max(1, openPairs.length));

    weightedScore += dayScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

/**
 * Fusionne le score NOAA théorique avec le score FT8 observé.
 * Utilisé par le forecast 7j pour améliorer la précision.
 * 
 * @param noaaScore - Score théorique du modèle NOAA (0-100)
 * @param ft8Score - Score observé basé sur l'historique FT8 (0-100)
 * @param ft8Confidence - Confiance dans le score FT8 (0-1)
 */
export function blendNoaaFt8Score(
  noaaScore: number,
  ft8Score: number,
  ft8Confidence: number,
): number {
  // Plus on a de données FT8, plus on leur fait confiance
  // Avec peu de données : 80% NOAA, 20% FT8
  // Avec beaucoup de données : 40% NOAA, 60% FT8
  const ft8Weight = 0.2 + 0.4 * ft8Confidence; // 0.2 → 0.6
  const noaaWeight = 1 - ft8Weight; // 0.8 → 0.4

  return Math.round(noaaScore * noaaWeight + ft8Score * ft8Weight);
}

/**
 * Récupère le score FT8 historique pour une zone/bande/heure donnée.
 * Utilisé pour enrichir le forecast 7j.
 */
export async function getFt8ScoreForZoneHour(
  band: string,
  continent: string,
  hourUtc: number,
  currentSfi: number | null = null,
  currentKp: number | null = null,
): Promise<{ score: number; confidence: number }> {
  const history = await getFt8HistoryForHour(hourUtc, band);
  return scoreFt8History(history, continent, currentSfi, currentKp);
}

/** Calcule un score FT8 depuis un historique déjà chargé, sans nouvelle requête DB. */
export function scoreFt8History(
  history: PropagationFt8Hourly[],
  continent: string,
  currentSfi: number | null = null,
  currentKp: number | null = null,
): { score: number; confidence: number; samples: number } {
  const contData = history.filter((h) => h.continent === continent);

  if (contData.length < 2) return { score: 0, confidence: 0, samples: contData.length };

  const today = new Date().toISOString().slice(0, 10);
  let weightedScore = 0;
  let totalWeight = 0;

  for (const row of contData) {
    const ageDays = Math.max(
      0,
      Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(row.snapDate + "T00:00:00Z")) / 86400_000),
    );
    const timeWeight = recencyWeight(ageDays);
    const solarWeight = solarSimilarityWeight(row.sfi, row.kp, currentSfi, currentKp);
    const weight = timeWeight * solarWeight;

    totalWeight += weight;
    if (row.spotCount >= MIN_SPOT_COUNT) {
      const snrScore = snrToScore(row.avgSnr ?? -10);
      weightedScore += snrScore * weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  const confidence = Math.min(1, contData.length / 56);

  return { score, confidence, samples: contData.length };
}
