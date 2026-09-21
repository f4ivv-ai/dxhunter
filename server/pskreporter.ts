/**
 * PSK Reporter MQTT — Agrégation des spots FT8 pour indicateur de propagation.
 *
 * Se connecte au broker MQTT mqtt.pskreporter.info (WebSocket TLS port 1886)
 * et souscrit aux spots FT8 sur les bandes contest (160/80/40/20/15/10m).
 *
 * Filtre : SNR > -18 dB (seuil bas = détection propagation même faible).
 * Agrège par bande + continent émetteur sur une fenêtre glissante de 5 min.
 * Supporte le filtrage par zone ITU de réception pour voir la propagation locale.
 *
 * Expose : getPropagationSummary(rxItuZone?) → résumé par bande/continent.
 */

import mqtt from "mqtt";
import {
  F4IVV_PROPAGATION_TOPICS,
  PRIMARY_KIWI,
} from "../shared/primaryKiwi";

// ─── Configuration ──────────────────────────────────────────────────────────

const BROKER_URL = "wss://mqtt.pskreporter.info:1886/mqtt";
const CONTEST_BANDS = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
type ContestBand = (typeof CONTEST_BANDS)[number];

const SNR_THRESHOLD = -18; // dB minimum pour détecter la propagation (seuil bas)
const WINDOW_MS = 5 * 60 * 1000; // fenêtre glissante de 5 minutes
const RETENTION_MS = 30 * 60 * 1000; // historique utile aux captures par quart d'heure
const MAX_SPOTS_IN_MEMORY = 50_000; // limite mémoire
const MAX_LOCAL_SPOTS_IN_MEMORY = 50_000; // réserve dédiée à F4IVV/JN25/ITU 27

// ─── Locator → Continent ────────────────────────────────────────────────────

function locatorToContinent(grid: string): string {
  if (!grid || grid.length < 2) return "??";
  const lon = (grid.charCodeAt(0) - 65) * 20 - 180 + (grid.length >= 3 ? parseInt(grid[2], 10) * 2 : 10);
  const lat = (grid.charCodeAt(1) - 65) * 10 - 90 + (grid.length >= 4 ? parseInt(grid[3], 10) : 5);

  // Classification simplifiée par zones géographiques
  if (lat > 60 && lon > -30 && lon < 60) return "EU"; // Scandinavie/Russie nord
  if (lat >= 35 && lat <= 72 && lon >= -30 && lon <= 60) return "EU";
  if (lat >= 15 && lat <= 72 && lon >= -170 && lon <= -50) return "NA";
  if (lat >= -60 && lat < 15 && lon >= -90 && lon <= -30) return "SA";
  if (lat >= -40 && lat <= 35 && lon >= -20 && lon <= 55) return "AF";
  if (lat >= -10 && lat <= 72 && lon > 55 && lon <= 180) return "AS";
  if (lat >= -10 && lat <= 72 && lon >= -180 && lon <= -170) return "AS"; // extrême est
  if (lat < -10 && lon > 100) return "OC";
  if (lat >= -50 && lat < -10 && lon > 55 && lon <= 180) return "OC";
  return "??";
}

// ─── Locator → Zone ITU (approximation par coordonnées) ─────────────────────

function gridToLatLon(grid: string): { lat: number; lon: number } {
  const G = grid.toUpperCase();
  let lon = (G.charCodeAt(0) - 65) * 20 - 180;
  let lat = (G.charCodeAt(1) - 65) * 10 - 90;
  if (G.length >= 3) lon += parseInt(G[2], 10) * 2 + 1;
  if (G.length >= 4) lat += parseInt(G[3], 10) + 0.5;
  return { lat, lon };
}

/**
 * Convertit un locator Maidenhead en zone ITU approximative.
 * Zones clés pour le contest HF depuis la France :
 *   27 = France, Belgique, Pays-Bas, Suisse, UK, Irlande
 *   28 = Italie, Espagne, Portugal, Grèce
 *   18 = Scandinavie
 *   8 = Amérique du Nord Est
 *   45 = Japon
 */
export function locatorToItuZone(grid: string): number {
  if (!grid || grid.length < 4) return 0;
  const { lat, lon } = gridToLatLon(grid);

  // Europe de l'Ouest (zone 27) : France, Belgique, Pays-Bas, Luxembourg, Suisse, Allemagne Ouest
  if (lat >= 42 && lat <= 55 && lon >= -5 && lon <= 10) return 27;
  // UK + Irlande (zone 27 aussi)
  if (lat >= 50 && lat <= 60 && lon >= -11 && lon <= 2) return 27;

  // Europe du Sud (zone 28) : Espagne, Portugal, Italie, Grèce, Turquie Ouest
  if (lat >= 35 && lat < 42 && lon >= -10 && lon <= 30) return 28;
  if (lat >= 42 && lat <= 47 && lon > 10 && lon <= 20) return 28; // Italie du Nord, Autriche

  // Europe Centrale/Est (zone 29) : Pologne, Tchéquie, Hongrie, Roumanie
  if (lat >= 44 && lat <= 55 && lon > 10 && lon <= 30) return 29;

  // Scandinavie (zone 18) : Norvège, Suède, Finlande
  if (lat > 55 && lat <= 72 && lon >= 5 && lon <= 30) return 18;
  // Danemark (zone 18)
  if (lat >= 54 && lat <= 58 && lon >= 8 && lon <= 15) return 18;

  // Russie européenne (zone 16/19/20)
  if (lat >= 50 && lat <= 72 && lon > 30 && lon <= 60) return 16;
  if (lat >= 40 && lat < 50 && lon > 30 && lon <= 60) return 20;

  // Amérique du Nord Est (zone 8) : USA Est, Canada Est
  if (lat >= 25 && lat <= 50 && lon >= -90 && lon <= -60) return 8;
  // Amérique du Nord Ouest (zone 6) : USA Ouest
  if (lat >= 30 && lat <= 50 && lon >= -130 && lon < -90) return 6;
  // Amérique du Nord Centre (zone 7)
  if (lat >= 30 && lat <= 50 && lon >= -105 && lon < -90) return 7;
  // Canada (zone 4)
  if (lat > 50 && lat <= 72 && lon >= -140 && lon <= -60) return 4;

  // Amérique du Sud (zone 12/13)
  if (lat >= -35 && lat < 10 && lon >= -80 && lon <= -35) return 12;
  if (lat < -35 && lon >= -80 && lon <= -50) return 13;

  // Afrique du Nord (zone 37)
  if (lat >= 20 && lat < 35 && lon >= -20 && lon <= 40) return 37;
  // Afrique Sub-Saharienne (zone 46)
  if (lat >= -35 && lat < 20 && lon >= -20 && lon <= 55) return 46;

  // Japon (zone 45)
  if (lat >= 25 && lat <= 46 && lon >= 125 && lon <= 150) return 45;
  // Asie du Sud-Est (zone 49)
  if (lat >= -10 && lat <= 25 && lon >= 95 && lon <= 140) return 49;
  // Asie Centrale (zone 30)
  if (lat >= 25 && lat <= 55 && lon > 60 && lon <= 125) return 30;

  // Océanie (zone 60)
  if (lat >= -50 && lat <= -10 && lon >= 110 && lon <= 180) return 60;

  // Caraïbes (zone 11)
  if (lat >= 10 && lat <= 25 && lon >= -90 && lon <= -60) return 11;

  return 0; // inconnu
}

// ─── Structure de données ───────────────────────────────────────────────────

export interface FT8Spot {
  band: ContestBand;
  snr: number;
  txCall: string;
  rxCall: string;
  txGrid: string;
  rxGrid: string;
  txContinent: string;
  rxContinent: string;
  rxItuZone: number;
  timestamp: number; // epoch ms
  distance: number; // km approximatif
  sequence: string;
  isPrimaryReceiver: boolean;
  isPrimaryTransmitter: boolean;
}

interface BandContinentSummary {
  band: ContestBand;
  continent: string;
  spotCount: number;
  avgSnr: number;
  maxSnr: number;
  bestCall: string;
}

export interface PropagationSummary {
  bands: Record<ContestBand, {
    total: number;
    continents: Record<string, { count: number; avgSnr: number; maxSnr: number }>;
  }>;
  lastUpdate: number;
  connected: boolean;
  windowMinutes: number;
  filteredByZone?: number; // zone ITU si filtré
  totalSpotsInWindow: number; // total avant filtrage
  primaryReceiver: {
    callsign: string;
    locator: string;
    rxSpots: number;
    txSpots: number;
    lastUpdate: number;
    active: boolean;
  };
}

export type PropagationCaptureSource = "F4IVV" | "JN25" | "ITU27" | "WORLD";

export interface PropagationSpotSelection {
  source: PropagationCaptureSource;
  spots: FT8Spot[];
  primaryCount: number;
  regionalCount: number;
}

// ─── État global ────────────────────────────────────────────────────────────

let spots: FT8Spot[] = [];
let localSpots: FT8Spot[] = [];
let connected = false;
let client: mqtt.MqttClient | null = null;
let lastUpdate = 0;
let lastPrimaryUpdate = 0;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 10_000;
const seenSequences = new Map<string, number>();
let lastPruneAt = 0;

// ─── Connexion MQTT ─────────────────────────────────────────────────────────

function startMqttConnection() {
  if (client) return;

  try {
    client = mqtt.connect(BROKER_URL, {
      clean: true,
      connectTimeout: 15_000,
      reconnectPeriod: RECONNECT_DELAY_MS,
      keepalive: 60,
    });

    client.on("connect", () => {
      connected = true;
      connectionAttempts = 0;
      console.log("[PSKReporter] MQTT connected");

      // Flux général : nécessaire au tableau monde et au secours régional.
      for (const band of CONTEST_BANDS) {
        const topic = `pskr/filter/v2/${band}/FT8/#`;
        client!.subscribe(topic, { qos: 0 }, (err) => {
          if (err) console.error(`[PSKReporter] Subscribe error ${band}:`, err.message);
        });
      }

      // Flux F4IVV prioritaire : TX fourni par l'utilisateur + miroir RX,
      // puis JN25 comme secours local si le décodeur n'annonce pas F4IVV.
      for (const topic of F4IVV_PROPAGATION_TOPICS) {
        client!.subscribe(topic, { qos: 0 }, (err) => {
          if (err) console.error(`[PSKReporter] Subscribe error ${topic}:`, err.message);
        });
      }
    });

    client.on("message", (_topic, payload) => {
      try {
        const spot = JSON.parse(payload.toString());
        processSpot(spot);
      } catch {
        // payload invalide, ignorer
      }
    });

    client.on("error", (err) => {
      console.error("[PSKReporter] MQTT error:", err.message);
    });

    client.on("close", () => {
      connected = false;
      connectionAttempts++;
      if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn("[PSKReporter] Max reconnect attempts reached, stopping");
        stopMqttConnection();
      }
    });

    client.on("offline", () => {
      connected = false;
    });
  } catch (err: any) {
    console.error("[PSKReporter] Connection failed:", err?.message);
  }
}

function stopMqttConnection() {
  if (client) {
    client.end(true);
    client = null;
  }
  connected = false;
}

// ─── Traitement d'un spot ───────────────────────────────────────────────────

function processSpot(raw: any) {
  // Payload JSON PSK Reporter :
  // { sq, f, md, rp, t, t_tx, sc, sl, rc, rl, sa, ra, b }
  const snr = raw.rp;
  const band = raw.b as ContestBand;
  const txGrid = raw.sl || "";
  const rxGrid = raw.rl || "";
  const txCall = normalizeCall(raw.sc);
  const rxCall = normalizeCall(raw.rc);
  const sequence = String(raw.sq ?? `${raw.f ?? "?"}-${raw.t_tx ?? raw.t ?? "?"}-${txCall}-${rxCall}`);

  // Filtre SNR
  if (typeof snr !== "number" || snr < SNR_THRESHOLD) return;

  // Filtre bande contest
  if (!CONTEST_BANDS.includes(band)) return;

  // Les abonnements général/F4IVV/JN25 se recouvrent : un spot ne doit compter qu'une fois.
  if (seenSequences.has(sequence)) return;

  const txContinent = locatorToContinent(txGrid);
  const rxContinent = locatorToContinent(rxGrid);
  const rxItuZone = locatorToItuZone(rxGrid);

  // Distance approximative depuis le locator (4 chars)
  const distance = estimateDistance(txGrid, rxGrid);

  const spot: FT8Spot = {
    band,
    snr,
    txCall,
    rxCall,
    txGrid,
    rxGrid,
    txContinent,
    rxContinent,
    rxItuZone,
    timestamp: Date.now(),
    distance,
    sequence,
    isPrimaryReceiver: rxCall === PRIMARY_KIWI.callsign,
    isPrimaryTransmitter: txCall === PRIMARY_KIWI.callsign,
  };

  spots.push(spot);
  const isLocalFallback =
    spot.isPrimaryReceiver ||
    spot.rxGrid.toUpperCase().startsWith(PRIMARY_KIWI.locator.slice(0, 4).toUpperCase()) ||
    spot.rxItuZone === 27;
  if (isLocalFallback) localSpots.push(spot);
  seenSequences.set(sequence, spot.timestamp);
  lastUpdate = Date.now();
  if (spot.isPrimaryReceiver) lastPrimaryUpdate = lastUpdate;

  // Plafonds stricts : le flux mondial ne doit jamais évincer la réserve locale.
  if (spots.length > MAX_SPOTS_IN_MEMORY) {
    spots = spots.slice(-MAX_SPOTS_IN_MEMORY / 2);
  }
  if (localSpots.length > MAX_LOCAL_SPOTS_IN_MEMORY) {
    localSpots = localSpots.slice(-MAX_LOCAL_SPOTS_IN_MEMORY / 2);
  }
  while (seenSequences.size > MAX_SPOTS_IN_MEMORY + MAX_LOCAL_SPOTS_IN_MEMORY) {
    const oldest = seenSequences.keys().next().value;
    if (oldest === undefined) break;
    seenSequences.delete(oldest);
  }
  if (spot.timestamp - lastPruneAt >= 30_000) pruneOldSpots(spot.timestamp);
}

function normalizeCall(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function estimateDistance(grid1: string, grid2: string): number {
  if (!grid1 || !grid2 || grid1.length < 4 || grid2.length < 4) return 0;
  const loc1 = gridToLatLon(grid1);
  const loc2 = gridToLatLon(grid2);
  return haversine(loc1.lat, loc1.lon, loc2.lat, loc2.lon);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1), dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ─── Nettoyage fenêtre glissante ────────────────────────────────────────────

function pruneOldSpots(now = Date.now()) {
  const cutoff = now - RETENTION_MS;
  spots = spots.filter(s => s.timestamp > cutoff);
  localSpots = localSpots.filter(s => s.timestamp > cutoff);
  for (const [sequence, timestamp] of seenSequences) {
    if (timestamp <= cutoff) seenSequences.delete(sequence);
  }
  lastPruneAt = now;
}

function getAllSpots(): FT8Spot[] {
  const merged = new Map<string, FT8Spot>();
  for (const spot of spots) merged.set(spot.sequence, spot);
  for (const spot of localSpots) merged.set(spot.sequence, spot);
  return [...merged.values()];
}

/**
 * Sélectionne la mesure la plus locale disponible pour l'apprentissage :
 * récepteur F4IVV, puis locator JN25, puis zone ITU 27, puis monde.
 */
export function selectPropagationSpotsForCapture(
  inputSpots: FT8Spot[],
  windowMs = 20 * 60 * 1000,
  now = Date.now(),
): PropagationSpotSelection {
  const cutoff = now - windowMs;
  const recent = inputSpots.filter((spot) => spot.timestamp > cutoff);
  const primary = recent.filter((spot) => spot.isPrimaryReceiver);
  const locator = recent.filter((spot) =>
    spot.rxGrid.toUpperCase().startsWith(PRIMARY_KIWI.locator.slice(0, 4).toUpperCase()),
  );
  const regional = recent.filter((spot) => spot.rxItuZone === 27);

  if (primary.length > 0) {
    return { source: "F4IVV", spots: primary, primaryCount: primary.length, regionalCount: regional.length };
  }
  if (locator.length > 0) {
    return { source: "JN25", spots: locator, primaryCount: 0, regionalCount: regional.length };
  }
  if (regional.length > 0) {
    return { source: "ITU27", spots: regional, primaryCount: 0, regionalCount: regional.length };
  }
  return { source: "WORLD", spots: recent, primaryCount: 0, regionalCount: 0 };
}

/** Attend brièvement un échantillon frais sur démarrage à froid d'une instance Autoscale. */
export async function waitForFreshPskSample(maxWaitMs = 8_000): Promise<void> {
  startMqttConnection();
  const startedAt = Date.now();
  if (lastPrimaryUpdate > startedAt - 90_000) return;
  while (Date.now() - startedAt < maxWaitMs) {
    if (lastPrimaryUpdate >= startedAt) return;
    if (connected && lastUpdate >= startedAt && Date.now() - startedAt >= 3_000) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Retourne le résumé de propagation FT8 par bande et par continent.
 * Fenêtre glissante de 5 minutes.
 * @param rxItuZone - Si spécifié, filtre uniquement les spots reçus dans cette zone ITU.
 */
export function getPropagationSummary(rxItuZone?: number): PropagationSummary {
  pruneOldSpots();

  const cutoff = Date.now() - WINDOW_MS;
  const windowSpots = getAllSpots().filter((spot) => spot.timestamp > cutoff);
  const totalSpotsInWindow = windowSpots.length;

  // Filtrer par zone ITU de réception si demandé
  const baseSpots = rxItuZone ? windowSpots.filter(s => s.rxItuZone === rxItuZone) : windowSpots;

  const bands: PropagationSummary["bands"] = {} as any;

  for (const band of CONTEST_BANDS) {
    const bandSpots = baseSpots.filter(s => s.band === band);
    const continents: Record<string, { count: number; avgSnr: number; maxSnr: number }> = {};

    for (const s of bandSpots) {
      const cont = s.txContinent;
      if (!continents[cont]) {
        continents[cont] = { count: 0, avgSnr: 0, maxSnr: -99 };
      }
      continents[cont].count++;
      continents[cont].maxSnr = Math.max(continents[cont].maxSnr, s.snr);
    }

    // Calculer les moyennes
    for (const cont of Object.keys(continents)) {
      const contSpots = bandSpots.filter(s => s.txContinent === cont);
      continents[cont].avgSnr = Math.round(
        contSpots.reduce((sum, s) => sum + s.snr, 0) / contSpots.length
      );
    }

    bands[band] = { total: bandSpots.length, continents };
  }

  return {
    bands,
    lastUpdate,
    connected,
    windowMinutes: WINDOW_MS / 60_000,
    filteredByZone: rxItuZone,
    totalSpotsInWindow,
    primaryReceiver: {
      callsign: PRIMARY_KIWI.callsign,
      locator: PRIMARY_KIWI.locator,
      rxSpots: windowSpots.filter((spot) => spot.isPrimaryReceiver).length,
      txSpots: windowSpots.filter((spot) => spot.isPrimaryTransmitter).length,
      lastUpdate: lastPrimaryUpdate,
      active: lastPrimaryUpdate > Date.now() - WINDOW_MS,
    },
  };
}

/**
 * Retourne le résumé filtré pour une bande spécifique.
 */
export function getBandPropagation(band: ContestBand, rxItuZone?: number) {
  pruneOldSpots();
  const cutoff = Date.now() - WINDOW_MS;
  const windowSpots = getAllSpots().filter((spot) => spot.timestamp > cutoff);
  const baseSpots = rxItuZone ? windowSpots.filter(s => s.rxItuZone === rxItuZone) : windowSpots;
  const bandSpots = baseSpots.filter(s => s.band === band);
  const continents: Record<string, { count: number; avgSnr: number; maxSnr: number; topCalls: string[] }> = {};

  for (const s of bandSpots) {
    const cont = s.txContinent;
    if (!continents[cont]) {
      continents[cont] = { count: 0, avgSnr: 0, maxSnr: -99, topCalls: [] };
    }
    continents[cont].count++;
    continents[cont].maxSnr = Math.max(continents[cont].maxSnr, s.snr);
  }

  for (const cont of Object.keys(continents)) {
    const contSpots = bandSpots.filter(s => s.txContinent === cont);
    continents[cont].avgSnr = Math.round(
      contSpots.reduce((sum, s) => sum + s.snr, 0) / contSpots.length
    );
  }

  return { band, total: bandSpots.length, continents, connected };
}

/**
 * Retourne les statistiques par zone ITU de réception (top zones actives).
 */
export function getZoneStats(): { zone: number; count: number }[] {
  pruneOldSpots();
  const zoneMap = new Map<number, number>();
  const cutoff = Date.now() - WINDOW_MS;
  for (const s of getAllSpots().filter((spot) => spot.timestamp > cutoff)) {
    if (s.rxItuZone === 0) continue;
    zoneMap.set(s.rxItuZone, (zoneMap.get(s.rxItuZone) || 0) + 1);
  }
  return Array.from(zoneMap.entries())
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Initialise la connexion MQTT. Appelé au démarrage du serveur.
 */
export function initPskReporter() {
  startMqttConnection();
}

/**
 * Arrête proprement la connexion MQTT.
 */
export function shutdownPskReporter() {
  stopMqttConnection();
}

// Export pour les tests et le module de capture horaire
export { locatorToContinent, gridToLatLon, CONTEST_BANDS, SNR_THRESHOLD };

/** Retourne les spots bruts en mémoire (pour la capture horaire FT8). */
export function _getSpots(): FT8Spot[] {
  pruneOldSpots();
  return getAllSpots();
}

/** Retourne TOUS les spots (pas de prune) accumulés depuis le dernier nettoyage — fenêtre étendue. */
export function _getSpotsExtended(windowMs: number): FT8Spot[] {
  const cutoff = Date.now() - windowMs;
  return getAllSpots().filter(s => s.timestamp > cutoff);
}

/** Test helper : injecte un spot synthétique dans la mémoire. */
export function _testInjectSpot(opts: {
  band: ContestBand;
  continent: string;
  snr: number;
  rxItuZone?: number;
  txCall?: string;
  rxCall?: string;
  rxGrid?: string;
  timestamp?: number;
}) {
  if (opts.snr < SNR_THRESHOLD) return; // reproduit le filtre
  const txCall = opts.txCall ?? "TESTDX";
  const rxCall = opts.rxCall ?? "TESTRX";
  const spot: FT8Spot = {
    band: opts.band,
    snr: opts.snr,
    txCall,
    rxCall,
    txGrid: "",
    rxGrid: opts.rxGrid ?? "JN25",
    txContinent: opts.continent,
    rxContinent: "EU",
    rxItuZone: opts.rxItuZone ?? 27,
    timestamp: opts.timestamp ?? Date.now(),
    distance: 0,
    sequence: `test-${Date.now()}-${spots.length}`,
    isPrimaryReceiver: rxCall === PRIMARY_KIWI.callsign,
    isPrimaryTransmitter: txCall === PRIMARY_KIWI.callsign,
  };
  spots.push(spot);
  if (spot.isPrimaryReceiver || spot.rxGrid.toUpperCase().startsWith("JN25") || spot.rxItuZone === 27) {
    localSpots.push(spot);
  }
  lastUpdate = Date.now();
  if (rxCall === PRIMARY_KIWI.callsign) {
    lastPrimaryUpdate = lastUpdate;
  }
}

/** Test helper : vide toute la mémoire. */
export function _testReset() {
  spots = [];
  localSpots = [];
  lastUpdate = 0;
  lastPrimaryUpdate = 0;
  lastPruneAt = 0;
  seenSequences.clear();
}
