import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { listCalibrationSnapshots, calibrationByDate } from "../db";
import { captureCalibration } from "../calibrationCapture";
import {
  calibrationAccuracy,
  learnCorrections,
  applyCorrection,
  predictScore,
  CALIB_ZONES,
  ALL_CONTEST_BANDS,
  ContestBand,
} from "../calibration";
import { computeForecast7d } from "../forecast";
import { findNearbyWebsdr, locatorToLatLon } from "../websdr";
import { findCorridorSdrs } from "../selfmonitor";
import {
  getPropagationSummary,
  getBandPropagation,
  getZoneStats,
  initPskReporter,
  CONTEST_BANDS,
  _getSpotsExtended,
  selectPropagationSpotsForCapture,
} from "../pskreporter";
import { getFt8HistoryForHour, listFt8HourlySnapshots } from "../db";
import { CONTINENT_CENTERS, bearing as calcBearing } from "../ft8HourlyCapture";
import { gridToLatLon } from "../pskreporter";
import { getMuf } from "../muf";
import { ingestSpot, getOpenings, getVhfActivity, initPropagationDetector } from "../propagationDetector";
import { computeFt8Predictions } from "../ft8Predictor";

// Initialiser PSK Reporter MQTT au chargement du module
initPskReporter();
// Initialiser le détecteur de propagation anormale
initPropagationDetector();

const SPOTHOLE = "https://spothole.app/api/v1";
const NOAA = "https://services.swpc.noaa.gov";

const TRACKED_BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm"] as const;

const inputSchema = z
  .object({
    maxAge: z.number().int().min(300).max(21600).default(7200),
    limit: z.number().int().min(1).max(500).default(500),
  })
  .optional();

async function fetchJson(url: string, ms: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string, ms: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Parse le tableau 27-day outlook NOAA en lignes {date, sfi, a, kp}. */
function parse27Day(txt: string): Array<{ date: string; sfi: number; a: number; kp: number }> {
  const out: Array<{ date: string; sfi: number; a: number; kp: number }> = [];
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  for (const line of txt.split("\n")) {
    const m = line.match(/^(\d{4})\s+(\w{3})\s+(\d{1,2})\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (m) {
      const [, y, mon, d, sfi, a, kp] = m;
      const mm = months[mon] ?? "01";
      out.push({
        date: `${y}-${mm}-${d.padStart(2, "0")}`,
        sfi: Number(sfi),
        a: Number(a),
        kp: Number(kp),
      });
    }
  }
  return out;
}

/**
 * Router des spots DX + météo spatiale.
 * Toutes les requêtes externes passent CÔTÉ SERVEUR (évite CORS/CSP).
 */
const DXSUMMIT_API = "http://www.dxsummit.fi/api/v1/spots";

/** Convertit une fréquence kHz en bande HF/VHF/UHF (inclut WARC). */
function freqToBand(freqKhz: number): string | null {
  if (freqKhz >= 1800 && freqKhz <= 2000) return "160m";
  if (freqKhz >= 3500 && freqKhz <= 4000) return "80m";
  if (freqKhz >= 5351 && freqKhz <= 5367) return "60m";
  if (freqKhz >= 7000 && freqKhz <= 7300) return "40m";
  if (freqKhz >= 10100 && freqKhz <= 10150) return "30m";
  if (freqKhz >= 14000 && freqKhz <= 14350) return "20m";
  if (freqKhz >= 18068 && freqKhz <= 18168) return "17m";
  if (freqKhz >= 21000 && freqKhz <= 21450) return "15m";
  if (freqKhz >= 24890 && freqKhz <= 24990) return "12m";
  if (freqKhz >= 28000 && freqKhz <= 29700) return "10m";
  if (freqKhz >= 50000 && freqKhz < 54000) return "6m";
  if (freqKhz >= 70000 && freqKhz < 70500) return "4m";
  if (freqKhz >= 144000 && freqKhz < 148000) return "2m";
  if (freqKhz >= 430000 && freqKhz < 440000) return "70cm";
  return null;
}

/** Normalise un spot DX Summit au format Spothole RawSpot. */
function normalizeDxSummitSpot(s: {
  id: number;
  dx_call: string;
  de_call: string;
  frequency: number;
  time: string;
  info: string | null;
  dx_country: string | null;
  dx_latitude: number | null;
  dx_longitude: number | null;
  de_latitude: number | null;
  de_longitude: number | null;
}): Record<string, unknown> {
  const freqHz = s.frequency * 1000;
  const band = freqToBand(s.frequency);
  const timeEpoch = Math.floor(new Date(s.time + "Z").getTime() / 1000);
  return {
    id: `dxs-${s.id}`,
    dx_call: s.dx_call,
    dx_name: null,
    dx_qth: null,
    dx_country: s.dx_country,
    dx_flag: null,
    dx_continent: null,
    dx_dxcc_id: null,
    dx_cq_zone: null,
    dx_latitude: s.dx_latitude,
    dx_longitude: s.dx_longitude != null ? -s.dx_longitude : null, // DX Summit inverts lon sign
    dx_location_good: s.dx_latitude !== null,
    de_call: (s.de_call || "").replace(/-@$/, ""),
    de_country: null,
    de_continent: null,
    de_latitude: s.de_latitude,
    de_longitude: s.de_longitude != null ? -s.de_longitude : null, // DX Summit inverts lon sign
    mode: "SSB",
    mode_type: "PHONE",
    freq: freqHz,
    band,
    comment: s.info,
    qrt: false,
    time: timeEpoch,
    time_iso: s.time + "Z",
    received_time: timeEpoch,
    source: "DXSummit",
  };
}

/**
 * Dédoublonne les spots : si deux spots ont le même dx_call + même bande
 * dans une fenêtre de 2 minutes, on garde celui de Spothole (plus complet).
 */
function deduplicateSpots(spots: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>();
  for (const s of spots) {
    const call = String(s.dx_call || "").toUpperCase();
    const band = String(s.band || "");
    const time = Number(s.time || 0);
    // Clé de dédoublonnage : call + bande + créneau de 2 min
    const slot = Math.floor(time / 120);
    const key = `${call}|${band}|${slot}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, s);
    } else {
      // Priorité à Spothole (plus complet)
      if (String(s.source) !== "DXSummit") {
        seen.set(key, s);
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Filtre géographique des spotters : ne garde que les spots provenant
 * de stations européennes ou proches (Afrique du Nord, Moyen-Orient).
 * Zone acceptée : latitude 25°N-72°N, longitude -30°W à 60°E
 * Cela couvre l'Europe, l'Afrique du Nord, le Moyen-Orient proche.
 * Exclut : Amérique du Nord/Sud, Asie de l'Est, Océanie.
 */
function filterSpotterEuNearby(spot: {
  de_latitude?: number | null;
  de_longitude?: number | null;
  de_call?: string;
}): boolean {
  const lat = spot.de_latitude;
  const lon = spot.de_longitude;
  // Si pas de coordonnées spotter, on garde le spot (bénéfice du doute)
  if (lat == null || lon == null) return true;
  // Zone Europe élargie + Afrique du Nord + Moyen-Orient proche
  // Lat: 25°N (Sahara) à 72°N (Scandinavie nord)
  // Lon: -30°W (Açores/Islande) à 60°E (Oural/Iran)
  // Note: DX Summit utilise des longitudes inversées (ouest = positif)
  // donc on inverse le signe pour la comparaison
  const normalLon = -lon; // DX Summit: west is positive, normalize to standard
  return lat >= 25 && lat <= 72 && normalLon >= -30 && normalLon <= 60;
}

export const spotsRouter = router({
  list: publicProcedure.input(inputSchema).query(async ({ input }) => {
    const maxAge = input?.maxAge ?? 7200;
    const limit = input?.limit ?? 500;
    const bands = TRACKED_BANDS.join(",");
    const spotholeUrl = `${SPOTHOLE}/spots?band=${bands}&source=Cluster,RBN&max_age=${maxAge}&limit=${limit}&de_continent=EU,AF`;
    const dxSummitUrl = `${DXSUMMIT_API}?include=1.8Mhz,3.5MHz,5MHz,7MHz,10MHz,14MHz,18MHz,21MHz,24MHz,28MHz,50MHz,70MHz,144MHz,430MHz`;

    // Fetch les deux sources en parallèle (tolérant aux erreurs)
    const [spotholeResult, dxSummitResult] = await Promise.allSettled([
      fetchJson(spotholeUrl, 15000),
      fetchJson(dxSummitUrl, 10000),
    ]);

    let spotholeSpots: Record<string, unknown>[] = [];
    let dxSummitSpots: Record<string, unknown>[] = [];
    const errors: string[] = [];

    if (spotholeResult.status === "fulfilled" && Array.isArray(spotholeResult.value)) {
      spotholeSpots = spotholeResult.value as Record<string, unknown>[];
    } else {
      const reason = spotholeResult.status === "rejected" ? spotholeResult.reason : "not array";
      errors.push(`Spothole: ${reason}`);
      console.error("[spots.list] Spothole error:", reason);
    }

    if (dxSummitResult.status === "fulfilled" && Array.isArray(dxSummitResult.value)) {
      dxSummitSpots = (dxSummitResult.value as Array<any>)
        .filter(filterSpotterEuNearby)
        .map(normalizeDxSummitSpot);
    } else {
      const reason = dxSummitResult.status === "rejected" ? dxSummitResult.reason : "not array";
      errors.push(`DXSummit: ${reason}`);
      console.error("[spots.list] DXSummit error:", reason);
    }

    // Fusion + dédoublonnage (Spothole prioritaire)
    const merged = [...spotholeSpots, ...dxSummitSpots];
    const deduplicated = deduplicateSpots(merged);
    // Trier par received_time décroissant
    deduplicated.sort((a, b) => Number(b.received_time || 0) - Number(a.received_time || 0));
    // Limiter au nombre demandé
    const limited = deduplicated.slice(0, limit);

    // Alimenter le détecteur de propagation anormale avec TOUS les spots (avant filtrage)
    for (const s of deduplicated) {
      try {
        ingestSpot({
          id: String(s.id || ""),
          dx_call: String(s.dx_call || ""),
          de_call: String(s.de_call || ""),
          freq: Number(s.freq || 0),
          band: (s.band as string) || null,
          comment: (s.comment as string) || null,
          dx_country: (s.dx_country as string) || null,
          dx_continent: (s.dx_continent as string) || null,
          de_continent: (s.de_continent as string) || null,
          dx_latitude: s.dx_latitude != null ? Number(s.dx_latitude) : null,
          dx_longitude: s.dx_longitude != null ? Number(s.dx_longitude) : null,
          de_latitude: s.de_latitude != null ? Number(s.de_latitude) : null,
          de_longitude: s.de_longitude != null ? Number(s.de_longitude) : null,
          received_time: Number(s.received_time || 0),
        });
      } catch { /* ignore ingestion errors */ }
    }

    return {
      ok: true as const,
      fetchedAt: Date.now(),
      count: limited.length,
      spots: limited,
      sources: {
        spothole: spotholeSpots.length,
        dxSummit: dxSummitSpots.length,
        afterDedup: limited.length,
      },
      ...(errors.length > 0 ? { warnings: errors } : {}),
    };
  }),

  /** Conditions solaires / propagation (HamQSL via Spothole). */
  solar: publicProcedure.query(async () => {
    try {
      return { ok: true as const, data: await fetchJson(`${SPOTHOLE}/solar`, 12000) };
    } catch (e) {
      return { ok: false as const, data: null, error: e instanceof Error ? e.message : "unknown" };
    }
  }),

  /**
   * Météo spatiale temps réel NOAA SWPC : Kp planétaire (live), SFI (F10.7),
   * dernière éruption X-ray (classe + black-out), et prévision 27 jours.
   * Sert de base au moteur d'aide à la décision (effets sur les chemins 40 m).
   */
  spaceWeather: publicProcedure.query(async () => {
    const result: {
      ok: boolean;
      fetchedAt: number;
      kpNow: number | null;
      kpTime: string | null;
      aIndex: number | null;
      sfi: number | null;
      flareClass: string | null;
      flareTime: string | null;
      blackout: string | null;
      outlook: Array<{ date: string; sfi: number; a: number; kp: number }>;
      errors: string[];
    } = {
      ok: false,
      fetchedAt: Date.now(),
      kpNow: null,
      kpTime: null,
      aIndex: null,
      sfi: null,
      flareClass: null,
      flareTime: null,
      blackout: null,
      outlook: [],
      errors: [],
    };

    // Kp planétaire minute
    try {
      const kp = (await fetchJson(`${NOAA}/json/planetary_k_index_1m.json`, 8000)) as Array<{
        time_tag: string;
        kp_index: number;
        estimated_kp: number;
      }>;
      if (Array.isArray(kp) && kp.length) {
        const last = kp[kp.length - 1];
        result.kpNow = Number(last.estimated_kp ?? last.kp_index);
        result.kpTime = last.time_tag;
      }
    } catch (e) {
      result.errors.push(`kp:${e instanceof Error ? e.message : "err"}`);
    }

    // SFI (F10.7 cm) — dernière valeur
    try {
      const f = (await fetchJson(`${NOAA}/json/f107_cm_flux.json`, 8000)) as Array<{ flux: number }>;
      if (Array.isArray(f) && f.length) {
        result.sfi = Math.round(Number(f[f.length - 1].flux));
      }
    } catch (e) {
      result.errors.push(`sfi:${e instanceof Error ? e.message : "err"}`);
    }

    // Dernière éruption X-ray + classe de black-out
    try {
      const fl = (await fetchJson(`${NOAA}/json/goes/primary/xray-flares-latest.json`, 8000)) as Array<{
        max_class: string;
        max_time: string;
      }>;
      if (Array.isArray(fl) && fl.length) {
        const cls = fl[0].max_class;
        result.flareClass = cls;
        result.flareTime = fl[0].max_time;
        result.blackout = blackoutFromFlare(cls);
      }
    } catch (e) {
      result.errors.push(`flare:${e instanceof Error ? e.message : "err"}`);
    }

    // Prévision 27 jours (SFI/A/Kp) — utile pour le plan contest
    try {
      const txt = await fetchText(`${NOAA}/text/27-day-outlook.txt`, 8000);
      result.outlook = parse27Day(txt);
    } catch (e) {
      result.errors.push(`outlook:${e instanceof Error ? e.message : "err"}`);
    }

    // Indice A planétaire : on prend l'A de la ligne "aujourd'hui" du 27-day
    // outlook (valeur observée/prévue NOAA) ; à défaut on le dérive du Kp.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const row = result.outlook.find((r) => r.date === today) ?? result.outlook[0];
      if (row && Number.isFinite(row.a)) {
        result.aIndex = row.a;
      } else if (result.kpNow != null) {
        result.aIndex = kpToApprox(result.kpNow);
      }
    } catch {
      if (result.kpNow != null) result.aIndex = kpToApprox(result.kpNow);
    }

    result.ok = result.kpNow !== null || result.sfi !== null || result.outlook.length > 0;
    return result;
  }),

  /* -------------------------------------------------------------- */
  /* Journal de calibration (entraînement J-12 → J-0)               */
  /* -------------------------------------------------------------- */

  /** Déclenche une capture manuelle "maintenant" (spots réels vs prédiction, toutes bandes). */
  runCalibration: publicProcedure.mutation(async () => {
    try {
      const r = await captureCalibration("manual");
      return { ok: true as const, saved: r.saved, spotCount: r.spotCount, bandCounts: r.bandCounts, solar: r.solar, at: r.at };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "unknown" };
    }
  }),

  /** Liste les snapshots de calibration des N derniers jours + agrégats. */
  listCalibration: publicProcedure
    .input(z.object({ days: z.number().int().min(1).max(30).default(14) }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 14;
      const rows = await listCalibrationSnapshots(days);
      const accuracy = calibrationAccuracy(rows);
      return { ok: true as const, rows, accuracy, count: rows.length };
    }),

  /** Snapshots d'une date précise (pour le détail horaire). */
  calibrationDay: publicProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const rows = await calibrationByDate(input.date);
      return { ok: true as const, rows, accuracy: calibrationAccuracy(rows) };
    }),

  /**
   * Scores 40 m corrigés par l'apprentissage : pour chaque zone, score brut du
   * modèle + score corrigé par le biais historique appris. Sert à affiner les
   * recommandations live au fil de l'entraînement J-12 → J-0.
   */
  forecast7d: publicProcedure
    .input(z.object({ locator: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const qth = input?.locator ? (locatorToLatLon(input.locator) ?? undefined) : undefined;
      const result = await computeForecast7d(qth);
      return result;
    }),

  calibratedScores: publicProcedure
    .input(
      z
        .object({
          kp: z.number().nullable().optional(),
          sfi: z.number().nullable().optional(),
          blackout: z.string().nullable().optional(),
          band: z.enum(["160m", "80m", "40m", "20m", "15m", "10m"]).optional(),
          locator: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rows = await listCalibrationSnapshots(14);
      const band: ContestBand = (input?.band as ContestBand) ?? "40m";
      // Resolve user QTH from locator if provided
      const qth = input?.locator ? (locatorToLatLon(input.locator) ?? undefined) : undefined;
      // Filtrer l'historique par bande pour l'apprentissage
      const bandRows = rows.filter((r) => (r as any).band === band || !(r as any).band);
      const corrections = learnCorrections(
        bandRows.map((r) => ({ zoneId: r.zoneId, error: r.error, snapDate: r.snapDate, band: (r as any).band })),
      );
      const now = new Date();
      const solar = {
        kp: input?.kp ?? null,
        sfi: input?.sfi ?? null,
        blackout: input?.blackout ?? null,
      };
      const zones = CALIB_ZONES.map((zone) => {
        const raw = predictScore(zone, now, solar, band, qth);
        const key = `${band}:${zone.id}`;
        const corr = corrections.get(key) ?? corrections.get(zone.id);
        const corrected = applyCorrection(raw, corr);
        return {
          zoneId: zone.id,
          zoneLabel: zone.label,
          rawScore: raw,
          correctedScore: corrected,
          bias: corr?.bias ?? 0,
          samples: corr?.samples ?? 0,
          confidence: corr?.confidence ?? 0,
        };
      });
      return { ok: true as const, zones, band, trained: rows.length > 0 };
    }),

  /** Trouve les WebSDR/KiwiSDR les plus proches du DX pour écouter le spot. */
  nearbyWebsdr: publicProcedure
    .input(
      z.object({
        dxCall: z.string(),
        freqKhz: z.number(),
        mode: z.string().optional(),
        dxLocator: z.string().optional(),
        dxLat: z.number().optional(),
        dxLon: z.number().optional(),
      })
    )
    .query(({ input }) => {
      const results = findNearbyWebsdr(
        input.dxCall,
        input.freqKhz,
        input.mode,
        input.dxLocator,
        5,
        input.dxLat ?? null,
        input.dxLon ?? null
      );
      return { ok: true as const, sdrs: results };
    }),

  /** Self-Monitor : trouve les WebSDR le long d'un corridor de propagation. */
  selfMonitor: publicProcedure
    .input(
      z.object({
        freqKhz: z.number().min(1800).max(30000),
        azimut: z.number().min(0).max(360),
        path: z.enum(["SP", "LP"]),
        mode: z.string().optional(),
        locator: z.string().optional(),
      })
    )
    .query(({ input }) => {
      let qthLat: number | undefined;
      let qthLon: number | undefined;
      if (input.locator) {
        const pos = locatorToLatLon(input.locator);
        if (pos) {
          qthLat = pos.lat;
          qthLon = pos.lon;
        }
      }
      const result = findCorridorSdrs(
        input.freqKhz,
        input.azimut,
        input.path,
        input.mode,
        qthLat,
        qthLon,
      );
      return { ok: true as const, ...result };
    }),

  /** Propagation FT8 temps réel via PSK Reporter — résumé toutes bandes. */
  ft8Propagation: publicProcedure
    .input(z.object({ rxItuZone: z.number().optional() }).optional())
    .query(({ input }) => {
      return getPropagationSummary(input?.rxItuZone);
    }),

  /** Propagation FT8 pour une bande spécifique. */
  ft8BandPropagation: publicProcedure
    .input(z.object({ band: z.enum(["160m", "80m", "40m", "20m", "15m", "10m"]), rxItuZone: z.number().optional() }))
    .query(({ input }) => {
      return getBandPropagation(input.band, input.rxItuZone);
    }),

  /** Statistiques par zone ITU de réception. */
  ft8ZoneStats: publicProcedure.query(() => {
    return getZoneStats();
  }),

  /**
   * Directions FT8 temps réel (30 min, SNR >= -8 dB).
   * Retourne par bande : continents ouverts, spotCount, avgSnr, azimut, direction cardinale.
   * Inclut une prédiction basée sur l'historique (même heure, 30 derniers jours).
   */
  ft8Directions: publicProcedure.query(async () => {
    const SNR_THRESHOLD_SSB = -8;
    const THIRTY_MIN = 30 * 60 * 1000;
    const QTH = { lat: 45.27, lon: 5.29 }; // JN25PG
    // Spots bruts des 30 dernières minutes. Priorité : F4IVV, JN25,
    // zone ITU 27, puis monde si aucune mesure plus locale n'est disponible.
    const rawSpots = _getSpotsExtended(THIRTY_MIN);
    const exploitableSpots = rawSpots.filter(s => s.snr >= SNR_THRESHOLD_SSB);
    const selected = selectPropagationSpotsForCapture(exploitableSpots, THIRTY_MIN);
    const validSpots = selected.spots;

    const bands = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
    const continents = ["EU", "NA", "SA", "AF", "AS", "OC"] as const;

    type ContinentInfo = {
      continent: string;
      spotCount: number;
      avgSnr: number;
      maxSnr: number;
      azimuth: number;
      cardinal: string;
      path: "SP" | "LP";
      lpAzimuth: number;
    };

    type BandDirection = {
      band: string;
      totalSpots: number;
      openContinents: ContinentInfo[];
      bestDirection: ContinentInfo | null;
    };

    function azToCardinal(az: number): string {
      const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
      return dirs[Math.round(az / 45) % 8];
    }

    const bandDirections: BandDirection[] = bands.map(band => {
      const bandSpots = validSpots.filter(s => s.band === band);
      const openContinents: ContinentInfo[] = [];

      for (const cont of continents) {
        const contSpots = bandSpots.filter(s => s.txContinent === cont);
        if (contSpots.length === 0) continue;

        const avgSnr = Math.round(contSpots.reduce((sum, s) => sum + s.snr, 0) / contSpots.length);
        const maxSnr = Math.max(...contSpots.map(s => s.snr));
        const center = CONTINENT_CENTERS[cont];
        const spAz = center ? Math.round(calcBearing(QTH.lat, QTH.lon, center.lat, center.lon)) : 0;
        const lpAz = (spAz + 180) % 360;

        // Détection LP : on utilise le grid locator TX pour calculer l'azimut réel
        let realAzSum = 0;
        let realAzCount = 0;
        for (const s of contSpots) {
          if (s.txGrid && s.txGrid.length >= 4) {
            const txCoords = gridToLatLon(s.txGrid);
            if (txCoords) {
              realAzSum += calcBearing(QTH.lat, QTH.lon, txCoords.lat, txCoords.lon);
              realAzCount++;
            }
          }
        }
        // Déterminer si LP ou SP en comparant l'azimut réel moyen au SP théorique
        let detectedPath: "SP" | "LP" = "SP";
        if (realAzCount > 0) {
          const realAzMean = realAzSum / realAzCount;
          const diffSP = Math.abs(((realAzMean - spAz + 540) % 360) - 180);
          const diffLP = Math.abs(((realAzMean - lpAz + 540) % 360) - 180);
          if (diffLP < diffSP) detectedPath = "LP";
        }

        openContinents.push({
          continent: cont,
          spotCount: contSpots.length,
          avgSnr,
          maxSnr,
          azimuth: detectedPath === "LP" ? lpAz : spAz,
          cardinal: azToCardinal(detectedPath === "LP" ? lpAz : spAz),
          path: detectedPath,
          lpAzimuth: lpAz,
        });
      }

      // Trier par nombre de spots décroissant
      openContinents.sort((a, b) => b.spotCount - a.spotCount);

      return {
        band,
        totalSpots: bandSpots.length,
        openContinents,
        bestDirection: openContinents[0] ?? null,
      };
    });

    // Direction dominante globale (toutes bandes confondues)
    const allOpen = bandDirections.flatMap(b => b.openContinents);
    const contAgg: Record<string, { count: number; snrSum: number; az: number }> = {};
    for (const c of allOpen) {
      if (!contAgg[c.continent]) contAgg[c.continent] = { count: 0, snrSum: 0, az: c.azimuth };
      contAgg[c.continent].count += c.spotCount;
      contAgg[c.continent].snrSum += c.avgSnr * c.spotCount;
    }
    const dominantContinent = Object.entries(contAgg).sort((a, b) => b[1].count - a[1].count)[0];
    // Déterminer le path dominant
    const dominantContinentInfo = dominantContinent ? allOpen.find(c => c.continent === dominantContinent[0]) : null;
    const dominant = dominantContinent ? {
      continent: dominantContinent[0],
      azimuth: dominantContinent[1].az,
      cardinal: azToCardinal(dominantContinent[1].az),
      totalSpots: dominantContinent[1].count,
      avgSnr: Math.round(dominantContinent[1].snrSum / dominantContinent[1].count),
      path: (dominantContinentInfo?.path ?? "SP") as "SP" | "LP",
    } : null;

    // Prédiction améliorée basée sur ft8Predictor (pondération temporelle + solaire + SNR + tendance)
    const ft8Result = await computeFt8Predictions(
      null, // SFI sera récupéré automatiquement si disponible
      null, // Kp idem
    );

    // Convertir les prédictions enrichies au format attendu par le frontend
    const predictions = ft8Result.predictions.map(p => {
      const center = CONTINENT_CENTERS[p.continent];
      const az = center ? Math.round(calcBearing(QTH.lat, QTH.lon, center.lat, center.lon)) : 0;
      return {
        band: p.band,
        continent: p.continent,
        probability: p.probability,
        azimuth: az,
        cardinal: azToCardinal(az),
        confidence: p.confidence,
        expectedSnr: p.expectedSnr,
        trend: p.trend,
      };
    });

    return {
      timestamp: Date.now(),
      windowMinutes: 30,
      snrThreshold: SNR_THRESHOLD_SSB,
      totalValidSpots: validSpots.length,
      receiverSource: selected.source,
      primaryReceiverSpots: selected.primaryCount,
      bandDirections,
      dominant,
      predictions: predictions.slice(0, 15),
      modelScore: {
        currentHour: ft8Result.currentHourScore,
        nextHour: ft8Result.nextHourScore,
        daysOfData: ft8Result.modelInfo.daysOfData,
      },
    };
  }),

  /** MUF temps réel via ionosondes GIRO (Dourbes + Rome). */
  muf: publicProcedure.query(async () => {
    return getMuf();
  }),

  /** Ouvertures de propagation anormale détectées (Es, TEP, Tropo, MS, Aurora). */
  propagationOpenings: publicProcedure.query(() => {
    return getOpenings();
  }),

  /** Activité VHF en cours (tous spots VHF dans la fenêtre de 30 min). */
  vhfActivity: publicProcedure.query(() => {
    return getVhfActivity();
  }),
});

/** Approxime l'indice A planétaire à partir du Kp courant (échelle empirique NOAA). */
function kpToApprox(kp: number): number {
  const table = [0, 2, 3, 4, 5, 6, 7, 9, 12, 15, 18, 22, 27, 32, 39, 48, 56, 67, 80, 94, 111, 132, 154, 179, 207, 236, 300, 400];
  const idx = Math.max(0, Math.min(table.length - 1, Math.round(kp * 3)));
  return table[idx];
}

/** Convertit une classe d'éruption (A/B/C/M/X) en échelle de black-out radio NOAA. */
function blackoutFromFlare(cls: string | null): string | null {
  if (!cls) return null;
  const letter = cls[0]?.toUpperCase();
  const mag = parseFloat(cls.slice(1)) || 0;
  if (letter === "X") return mag >= 10 ? "R4" : "R3";
  if (letter === "M") return mag >= 5 ? "R2" : "R1";
  return "R0"; // A, B, C : pas de black-out significatif
}
