#!/usr/bin/env node
/**
 * DX HUNTER — Telnet Relay v1
 *
 * Expose un serveur Telnet local (localhost:7300) pour SDC / DXLog / N1MM / Log4OM.
 * Se connecte au WebSocket DX Hunter (/api/ws/cluster) et retransmet les spots
 * en format texte DX Cluster standard.
 *
 * PAS de npm install requis. Node.js 18+ (WebSocket natif + net).
 *
 * Usage :
 *   node telnet-relay.mjs
 *
 * Configuration (variables d'environnement optionnelles) :
 *   SERVER_URL     — URL du serveur (defaut: https://dxhunter-4u9qguqx.manus.space)
 *   TELNET_PORT    — Port Telnet local (defaut: 7300)
 *   UDP_PORT       — Port UDP pour recevoir les QSO de SDC/N1MM (defaut: 12060)
 *   CONTEST_TOKEN  — Token pour poster les QSO au serveur (OBLIGATOIRE, 24 caractères minimum)
 */

import net from "node:net";
import dgram from "node:dgram";

// === Configuration ===
const SERVER_URL = process.env.SERVER_URL || "https://dxhunter-4u9qguqx.manus.space";
const TELNET_PORT = parseInt(process.env.TELNET_PORT || "7300");
const UDP_PORT = parseInt(process.env.UDP_PORT || "12060");
const CONTEST_TOKEN = process.env.CONTEST_TOKEN;
if (!CONTEST_TOKEN || CONTEST_TOKEN.length < 24) {
  console.error("ERREUR : définissez CONTEST_TOKEN (24 caractères minimum), identique au secret serveur.");
  process.exit(1);
}
const WS_URL = SERVER_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/cluster";
const CONTEST_QSO_URL = SERVER_URL + "/api/contest/qso";
const RECONNECT_DELAY_MS = 5000;
const PING_INTERVAL_MS = 30000;

// === State ===
let ws = null;
let wsConnected = false;
const telnetClients = new Set();
let pingTimer = null;
let reconnectTimer = null;

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 1 : Serveur Telnet (DX Hunter → SDC/DXLog)
// ─────────────────────────────────────────────────────────────────────────────

const telnetServer = net.createServer((socket) => {
  const addr = socket.remoteAddress + ":" + socket.remotePort;
  console.log("[TELNET] Client connecte: " + addr + " (total: " + (telnetClients.size + 1) + ")");
  telnetClients.add(socket);

  // Message de bienvenue (format DX Cluster login)
  socket.write("Hello F4IVV de DX-Hunter Cluster\r\n");
  socket.write("Bienvenue sur le relay DX Hunter — spots en temps reel\r\n");
  socket.write("\r\n");

  socket.on("data", (data) => {
    // Ignorer les commandes entrantes (SH/DX, etc.) — flux unidirectionnel
    const cmd = data.toString().trim().toUpperCase();
    if (cmd === "BYE" || cmd === "QUIT" || cmd === "EXIT") {
      socket.write("73 de DX-Hunter\r\n");
      socket.end();
    }
  });

  socket.on("close", () => {
    telnetClients.delete(socket);
    console.log("[TELNET] Client deconnecte: " + addr + " (restant: " + telnetClients.size + ")");
  });

  socket.on("error", (err) => {
    telnetClients.delete(socket);
    if (err.code !== "ECONNRESET") {
      console.error("[TELNET] Erreur client:", err.message);
    }
  });
});

telnetServer.listen(TELNET_PORT, "0.0.0.0", () => {
  console.log("[TELNET] Serveur actif sur port " + TELNET_PORT);
});

telnetServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("[TELNET] Port " + TELNET_PORT + " deja utilise ! Fermez l'autre instance.");
    process.exit(1);
  }
  console.error("[TELNET] Erreur serveur:", err.message);
});

/**
 * Envoie un message à tous les clients Telnet connectés.
 */
function broadcastTelnet(message) {
  for (const client of telnetClients) {
    if (!client.destroyed) {
      try {
        client.write(message);
      } catch {
        telnetClients.delete(client);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 2 : Connexion WebSocket à DX Hunter
// ─────────────────────────────────────────────────────────────────────────────

function connectWebSocket() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  console.log("[WS] Connexion a " + WS_URL + "...");

  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.error("[WS] Erreur creation:", err.message);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    console.log("[WS] Connecte !");
    wsConnected = true;
    // Ping keepalive
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.ping?.(); } catch {}
      }
    }, PING_INTERVAL_MS);
  });

  ws.addEventListener("message", (event) => {
    const data = typeof event.data === "string" ? event.data : event.data.toString();
    // Retransmettre directement aux clients Telnet
    if (telnetClients.size > 0) {
      broadcastTelnet(data);
    }
  });

  ws.addEventListener("close", () => {
    if (wsConnected) {
      console.log("[WS] Deconnecte");
    }
    wsConnected = false;
    ws = null;
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.error("[WS] Erreur:", err.message || "connexion echouee");
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log("[WS] Reconnexion dans " + (RECONNECT_DELAY_MS / 1000) + "s...");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, RECONNECT_DELAY_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 3 : Réception UDP des QSO (SDC/N1MM → DX Hunter)
// ─────────────────────────────────────────────────────────────────────────────

const udpServer = dgram.createSocket("udp4");

udpServer.on("message", async (msg, rinfo) => {
  const xml = msg.toString();
  
  // Détecter si c'est un QSO (contactinfo) ou un autre type de message
  if (xml.includes("<contactinfo>") || xml.includes("<ContactInfo>")) {
    const qso = parseN1MMQSO(xml);
    if (qso) {
      console.log("[QSO] " + qso.call + " " + qso.band + "m " + qso.mode + " (de " + rinfo.address + ")");
      await postContestQSO(qso);
    }
  } else if (xml.includes("<contactreplace>") || xml.includes("<ContactReplace>")) {
    // QSO modifié — même traitement
    const qso = parseN1MMQSO(xml);
    if (qso) {
      console.log("[QSO-EDIT] " + qso.call + " " + qso.band + "m " + qso.mode);
      await postContestQSO(qso);
    }
  } else if (xml.includes("<contactdelete>") || xml.includes("<ContactDelete>")) {
    // QSO supprimé
    const call = extractXML(xml, "call");
    if (call) {
      console.log("[QSO-DEL] " + call);
      await postContestQSODelete(call, xml);
    }
  }
});

udpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("[UDP] Port " + UDP_PORT + " deja utilise !");
  } else {
    console.error("[UDP] Erreur:", err.message);
  }
});

udpServer.bind(UDP_PORT, "0.0.0.0", () => {
  console.log("[UDP] Ecoute QSO sur port " + UDP_PORT + " (format N1MM/SDC)");
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 4 : Parsing XML N1MM et envoi au serveur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrait la valeur d'un tag XML simple (pas d'attributs).
 */
function extractXML(xml, tag) {
  // Case insensitive search
  const lower = xml.toLowerCase();
  const tagLower = tag.toLowerCase();
  const openIdx = lower.indexOf("<" + tagLower + ">");
  if (openIdx === -1) return "";
  const start = openIdx + tag.length + 2;
  const closeIdx = lower.indexOf("</" + tagLower + ">", start);
  if (closeIdx === -1) return "";
  return xml.slice(start, closeIdx).trim();
}

/**
 * Parse un message UDP N1MM/SDC en objet QSO.
 */
function parseN1MMQSO(xml) {
  const call = extractXML(xml, "call");
  if (!call) return null;

  const band = extractXML(xml, "band") || "";
  const mode = extractXML(xml, "mode") || "SSB";
  const rxfreq = extractXML(xml, "rxfreq") || "";
  const txfreq = extractXML(xml, "txfreq") || "";
  const timestamp = extractXML(xml, "timestamp") || "";
  const mycall = extractXML(xml, "mycall") || "F4IVV";
  const contestname = extractXML(xml, "contestname") || "";
  const snt = extractXML(xml, "snt") || "59";
  const sntnr = extractXML(xml, "sntnr") || "";
  const rcv = extractXML(xml, "rcv") || "59";
  const rcvnr = extractXML(xml, "rcvnr") || "";
  const exchange1 = extractXML(xml, "exchange1") || "";
  const zone = extractXML(xml, "zone") || "";
  const countryprefix = extractXML(xml, "countryprefix") || "";
  const wpxprefix = extractXML(xml, "wpxprefix") || "";
  const continent = extractXML(xml, "continent") || "";
  const gridsquare = extractXML(xml, "gridsquare") || "";
  const stationName = extractXML(xml, "StationName") || extractXML(xml, "stationname") || "";
  const isRunQSO = extractXML(xml, "IsRunQSO") || extractXML(xml, "isrunqso") || "0";
  const id = extractXML(xml, "ID") || extractXML(xml, "id") || "";

  // Fréquence en kHz (N1MM envoie en 10 Hz)
  let freqKhz = 0;
  if (rxfreq) {
    const f = parseInt(rxfreq, 10);
    if (f > 100000) freqKhz = f / 100; // 10 Hz → kHz
    else freqKhz = f;
  }

  return {
    call,
    band: band || bandFromFreq(freqKhz),
    mode,
    freqKhz,
    timestamp,
    mycall,
    contestname,
    snt,
    sntnr,
    rcv,
    rcvnr,
    exchange1,
    zone,
    countryprefix,
    wpxprefix,
    continent,
    gridsquare,
    stationName,
    isRunQSO: isRunQSO === "1",
    id,
  };
}

function bandFromFreq(freqKhz) {
  if (freqKhz >= 1800 && freqKhz <= 2000) return "160";
  if (freqKhz >= 3500 && freqKhz <= 4000) return "80";
  if (freqKhz >= 7000 && freqKhz <= 7300) return "40";
  if (freqKhz >= 14000 && freqKhz <= 14350) return "20";
  if (freqKhz >= 21000 && freqKhz <= 21450) return "15";
  if (freqKhz >= 28000 && freqKhz <= 29700) return "10";
  return "";
}

/**
 * Envoie un QSO au serveur DX Hunter.
 */
async function postContestQSO(qso) {
  try {
    const res = await fetch(CONTEST_QSO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + CONTEST_TOKEN,
      },
      body: JSON.stringify({ action: "add", qso }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[QSO] Erreur serveur:", res.status);
    }
  } catch (err) {
    console.error("[QSO] Erreur envoi:", err.message);
  }
}

/**
 * Signale la suppression d'un QSO au serveur.
 */
async function postContestQSODelete(call, xml) {
  try {
    const timestamp = extractXML(xml, "timestamp") || "";
    const band = extractXML(xml, "band") || "";
    const res = await fetch(CONTEST_QSO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + CONTEST_TOKEN,
      },
      body: JSON.stringify({ action: "delete", call, band, timestamp }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[QSO-DEL] Erreur serveur:", res.status);
    }
  } catch (err) {
    console.error("[QSO-DEL] Erreur envoi:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 5 : Démarrage
// ─────────────────────────────────────────────────────────────────────────────

console.log("==========================================");
console.log("  DX HUNTER - Telnet & Contest Relay v1");
console.log("  Telnet: localhost:" + TELNET_PORT);
console.log("  UDP QSO: port " + UDP_PORT + " (N1MM/SDC)");
console.log("  WebSocket: " + WS_URL);
console.log("  Serveur: " + SERVER_URL);
console.log("==========================================");
console.log("");

// Connecter au WebSocket DX Hunter
connectWebSocket();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[FIN] Arret propre...");
  if (ws) try { ws.close(); } catch {}
  telnetServer.close();
  udpServer.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (ws) try { ws.close(); } catch {}
  telnetServer.close();
  udpServer.close();
  process.exit(0);
});
