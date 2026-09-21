/**
 * WebSocket DX Cluster feed — /api/ws/cluster
 *
 * Diffuse les spots DX en format texte standard DX Cluster :
 *   DX de <spotter>:  <freq>  <dx_call>        <comment>              <time>Z
 *
 * Destiné à être consommé par un script relay Python qui expose un serveur Telnet
 * local (localhost:7300) pour Win-Test / DXLog.
 *
 * Architecture :
 * - Polling interne toutes les 12s (même cadence que le frontend)
 * - Détection des nouveaux spots par ID (Set)
 * - Broadcast à tous les clients WebSocket connectés
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";

// ─── Configuration ──────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 12_000; // 12 secondes (cohérent avec le frontend)
const SPOTHOLE_URL = "https://spothole.app/api/v1/spots?band=160m,80m,60m,40m,30m,20m,17m,15m,12m,10m&source=Cluster,RBN&max_age=7200&limit=500";
const DXSUMMIT_URL = "http://www.dxsummit.fi/api/v1/spots?include=1.8Mhz,3.5MHz,5MHz,7MHz,10MHz,14MHz,18MHz,21MHz,24MHz,28MHz&include_modes=PHONE";
const FETCH_TIMEOUT_MS = 15_000;
const MY_CALL = "F-13807"; // SWL callsign pour le champ "spotter"

// ─── State ──────────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const seenIds = new Set<string>();
let lastPollTime = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/** Convertit une fréquence kHz en bande HF (inclut WARC). */
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
  return null;
}

/**
 * Formate un spot en ligne DX Cluster standard.
 * Format : DX de <spotter>:     <freq>  <dx_call>       <comment>           <time>Z
 *
 * Exemple réel :
 * DX de F-13807:   14195.0  TM0HQ        cq cq cq 5/9              1044Z
 */
function formatClusterLine(spot: Record<string, unknown>): string {
  const dxCall = String(spot.dx_call || "UNKNOWN").padEnd(13);
  const deCall = String(spot.de_call || MY_CALL);

  // Fréquence en kHz avec 1 décimale
  let freqKhz: number;
  const rawFreq = Number(spot.freq || 0);
  if (rawFreq > 100000) {
    // freq en Hz → convertir en kHz
    freqKhz = rawFreq / 1000;
  } else {
    freqKhz = rawFreq;
  }
  const freqStr = freqKhz.toFixed(1).padStart(9);

  // Mode SSB : LSB en dessous de 10 MHz, USB au-dessus
  const rawMode = String(spot.mode || "").toUpperCase();
  let mode = rawMode;
  if (!mode || mode === "SSB" || mode === "USB" || mode === "LSB") {
    mode = freqKhz < 10000 ? "LSB" : "USB";
  }

  // Commentaire : injecter le mode corrigé en tête si pas déjà présent
  const rawComment = String(spot.comment || "");
  const commentWithMode = rawComment.toLowerCase().includes(mode.toLowerCase())
    ? rawComment
    : `${mode} ${rawComment}`.trim();
  const comment = commentWithMode.slice(0, 30).padEnd(30);

  // Heure UTC (HHMM format)
  let timeStr = "0000Z";
  const timeEpoch = Number(spot.time || spot.received_time || 0);
  if (timeEpoch > 0) {
    const d = new Date(timeEpoch * 1000);
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    timeStr = `${hh}${mm}Z`;
  }

  return `DX de ${deCall}:${freqStr}  ${dxCall}${comment} ${timeStr}\r\n`;
}

/**
 * Normalise un spot DX Summit pour le cluster feed.
 */
function normalizeDxSummitSpot(s: any): Record<string, unknown> | null {
  if (!s.dx_call || !s.frequency) return null;
  const freqKhz = s.frequency;
  const band = freqToBand(freqKhz);
  if (!band) return null;
  const timeEpoch = s.time ? Math.floor(new Date(s.time + "Z").getTime() / 1000) : Math.floor(Date.now() / 1000);
  return {
    id: `dxs-${s.id}`,
    dx_call: s.dx_call,
    de_call: (s.de_call || "").replace(/-@$/, ""),
    freq: freqKhz * 1000, // stocker en Hz pour cohérence
    band,
    comment: s.info || "",
    time: timeEpoch,
    received_time: timeEpoch,
    source: "DXSummit",
  };
}

// ─── Polling & Broadcast ────────────────────────────────────────────────────

async function pollAndBroadcast() {
  if (!wss || wss.clients.size === 0) return; // pas de clients → skip

  try {
    const [spotholeResult, dxSummitResult] = await Promise.allSettled([
      fetchJson(SPOTHOLE_URL, FETCH_TIMEOUT_MS),
      fetchJson(DXSUMMIT_URL, 10_000),
    ]);

    const allSpots: Record<string, unknown>[] = [];

    // Spothole spots
    if (spotholeResult.status === "fulfilled" && Array.isArray(spotholeResult.value)) {
      for (const s of spotholeResult.value as Record<string, unknown>[]) {
        allSpots.push(s);
      }
    }

    // DX Summit spots
    if (dxSummitResult.status === "fulfilled" && Array.isArray(dxSummitResult.value)) {
      for (const s of dxSummitResult.value as any[]) {
        const normalized = normalizeDxSummitSpot(s);
        if (normalized) allSpots.push(normalized);
      }
    }

    // Détecter les nouveaux spots (non encore vus)
    const newSpots: Record<string, unknown>[] = [];
    for (const spot of allSpots) {
      const id = String(spot.id || "");
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      newSpots.push(spot);
    }

    // Limiter la taille du Set (garder les 5000 plus récents)
    if (seenIds.size > 10000) {
      const arr = Array.from(seenIds);
      const toRemove = arr.slice(0, arr.length - 5000);
      for (const id of toRemove) seenIds.delete(id);
    }

    // Broadcast les nouveaux spots à tous les clients
    if (newSpots.length > 0) {
      // Trier par received_time croissant (les plus anciens d'abord)
      newSpots.sort((a, b) => Number(a.received_time || 0) - Number(b.received_time || 0));

      for (const spot of newSpots) {
        const line = formatClusterLine(spot);
        broadcast(line);
      }
    }

    lastPollTime = Date.now();
  } catch (err: any) {
    console.error("[ClusterWS] Poll error:", err?.message);
  }
}

function broadcast(message: string) {
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ─── Initialisation ─────────────────────────────────────────────────────────

/**
 * Attache le serveur WebSocket DX Cluster au serveur HTTP existant.
 * Path : /api/ws/cluster
 */
export function initClusterWebSocket(server: HttpServer): void {
  wss = new WebSocketServer({
    server,
    path: "/api/ws/cluster",
  });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress || "unknown";
    console.log(`[ClusterWS] Client connected from ${ip} (total: ${wss!.clients.size})`);

    // Message de bienvenue (format DX Cluster login)
    ws.send(`Hello ${MY_CALL} de DX-Hunter Cluster\r\n`);
    ws.send(`DX de DX-HUNTER: Connected — streaming DX spots in real-time\r\n`);
    ws.send(`\r\n`);

    ws.on("close", () => {
      console.log(`[ClusterWS] Client disconnected (remaining: ${wss!.clients.size})`);
    });

    ws.on("error", (err) => {
      console.error("[ClusterWS] Client error:", err.message);
    });

    // Ignorer les messages entrants (flux unidirectionnel)
    ws.on("message", () => {});
  });

  // Démarrer le polling
  pollTimer = setInterval(pollAndBroadcast, POLL_INTERVAL_MS);
  // Premier poll immédiat
  setTimeout(pollAndBroadcast, 2000);

  console.log("[ClusterWS] WebSocket DX Cluster feed initialized on /api/ws/cluster");
}

/**
 * Arrête le serveur WebSocket et le polling.
 */
export function stopClusterWebSocket(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  seenIds.clear();
}

// ─── Test helpers ───────────────────────────────────────────────────────────

export function _testGetSeenIds(): Set<string> {
  return seenIds;
}

export function _testFormatClusterLine(spot: Record<string, unknown>): string {
  return formatClusterLine(spot);
}

export function _testGetClientCount(): number {
  return wss?.clients.size ?? 0;
}
