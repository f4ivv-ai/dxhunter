#!/usr/bin/env node
/**
 * DX HUNTER — CAT Bridge Relay v6 (TCP CAT + HTTP Push)
 *
 * Architecture:
 * - Maintains a persistent TCP connection to SmartSDR CAT port (5001)
 * - Reads VFO frequency via Kenwood CAT protocol (FA; command)
 * - Executes QSY commands received from DX Hunter server (FA000XXXXXXXX;)
 * - Pushes state to DX Hunter server via HTTP POST (tRPC relay)
 * - Receives QSY commands back from server in the POST response
 *
 * PAS de npm install requis. Node.js 18+ (fetch natif + net).
 *
 * Usage :
 *   node bridge-relay.mjs
 *
 * Configuration (variables d'environnement optionnelles) :
 *   SERVER_URL  — URL du serveur (defaut: https://dxhunter-4u9qguqx.manus.space)
 *   TOKEN       — Token d'authentification (OBLIGATOIRE, 24 caractères minimum)
 *   CAT_PORT    — Port TCP CAT SmartSDR (defaut: 5001)
 */

import net from "node:net";

// === Configuration ===
const SERVER_URL = process.env.SERVER_URL || "https://dxhunter-4u9qguqx.manus.space";
const TOKEN = process.env.TOKEN;
if (!TOKEN || TOKEN.length < 24) {
  console.error("ERREUR : définissez TOKEN (24 caractères minimum), identique à CAT_BRIDGE_TOKEN côté serveur.");
  process.exit(1);
}
const CAT_HOST = "127.0.0.1";
const CAT_PORT = parseInt(process.env.CAT_PORT || "5001");
const FREQ_POLL_MS = 1000;
const PUSH_INTERVAL_MS = 800;
const RECONNECT_DELAY_MS = 5000;
const PUSH_URL = SERVER_URL + "/api/trpc/cat.push";

// === State ===
let currentFreq = 0;
let currentMode = "";
let radioConnected = false;
let catSocket = null;
let rxBuffer = "";
let pushBusy = false;
let freqPollTimer = null;

// === CAT TCP Connection ===

function connectCAT() {
  if (catSocket) {
    try { catSocket.destroy(); } catch {}
    catSocket = null;
  }

  console.log("[CAT] Connexion a " + CAT_HOST + ":" + CAT_PORT + "...");

  catSocket = net.createConnection(CAT_PORT, CAT_HOST, () => {
    console.log("[CAT] Connecte !");
    radioConnected = true;
    rxBuffer = "";
    // Start polling frequency
    if (freqPollTimer) clearInterval(freqPollTimer);
    freqPollTimer = setInterval(pollFrequency, FREQ_POLL_MS);
    // Initial read
    setTimeout(pollFrequency, 200);
  });

  catSocket.setKeepAlive(true, 10000);
  catSocket.setTimeout(15000);

  catSocket.on("data", (data) => {
    rxBuffer += data.toString();
    let idx;
    while ((idx = rxBuffer.indexOf(";")) !== -1) {
      const msg = rxBuffer.slice(0, idx + 1).trim();
      rxBuffer = rxBuffer.slice(idx + 1);
      if (msg) handleCATResponse(msg);
    }
  });

  catSocket.on("timeout", () => {
    console.log("[CAT] Timeout, tentative de reconnexion...");
    catSocket.destroy();
  });

  catSocket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log("[CAT] Port " + CAT_PORT + " refuse - SmartSDR CAT actif ?");
    } else {
      console.error("[CAT] Erreur:", err.message);
    }
  });

  catSocket.on("close", () => {
    if (radioConnected) {
      console.log("[CAT] Deconnecte");
    }
    radioConnected = false;
    catSocket = null;
    if (freqPollTimer) { clearInterval(freqPollTimer); freqPollTimer = null; }
    console.log("[CAT] Reconnexion dans " + (RECONNECT_DELAY_MS / 1000) + "s...");
    setTimeout(connectCAT, RECONNECT_DELAY_MS);
  });
}

function pollFrequency() {
  if (catSocket && catSocket.writable) {
    catSocket.write("FA;\r\n");
  }
}

function handleCATResponse(msg) {
  // FA response: FA00014208600;
  if (msg.startsWith("FA") && !msg.startsWith("FA;") && msg.length >= 10) {
    const hzStr = msg.slice(2, -1);
    const hz = parseInt(hzStr, 10);
    if (!isNaN(hz) && hz > 0) {
      const freqMHz = hz / 1000000;
      if (Math.abs(freqMHz - currentFreq) > 0.0001) {
        currentFreq = freqMHz;
        currentMode = freqMHz < 10 ? "LSB" : "USB";
        console.log("[FREQ] " + freqMHz.toFixed(3) + " MHz " + currentMode);
      }
    }
  }
  // IF response: IF00014254999100+000000000002000000;
  else if (msg.startsWith("IF") && msg.length > 30) {
    const hzStr = msg.slice(2, 13);
    const hz = parseInt(hzStr, 10);
    if (!isNaN(hz) && hz > 0) {
      const freqMHz = hz / 1000000;
      currentFreq = freqMHz;
      // Mode code at position 29
      const modeCode = msg.charAt(29);
      switch (modeCode) {
        case "1": currentMode = "LSB"; break;
        case "2": currentMode = "USB"; break;
        case "3": currentMode = "CW"; break;
        case "4": currentMode = "FM"; break;
        case "5": currentMode = "AM"; break;
        case "6": currentMode = "DIGU"; break;
        case "9": currentMode = "DIGL"; break;
        default: currentMode = freqMHz < 10 ? "LSB" : "USB";
      }
    }
  }
  // MD response: MD2;
  else if (msg.startsWith("MD") && msg.length >= 3) {
    const modeCode = msg.charAt(2);
    switch (modeCode) {
      case "1": currentMode = "LSB"; break;
      case "2": currentMode = "USB"; break;
      case "3": currentMode = "CW"; break;
      case "4": currentMode = "FM"; break;
      case "5": currentMode = "AM"; break;
      case "6": currentMode = "DIGU"; break;
      case "9": currentMode = "DIGL"; break;
    }
  }
}

// === QSY Command ===

function sendQSY(freqMHz) {
  if (!catSocket || !catSocket.writable) {
    console.log("[QSY] Impossible - pas connecte au CAT");
    return;
  }
  const hz = Math.round(freqMHz * 1000000);
  const cmd = "FA" + hz.toString().padStart(11, "0") + ";";
  console.log("[QSY] " + freqMHz.toFixed(3) + " MHz -> " + cmd);
  catSocket.write(cmd + "\r\n");
  // Read back after short delay to confirm
  setTimeout(pollFrequency, 300);
}

// === HTTP Push to Server ===

async function pushState() {
  if (pushBusy) return;
  pushBusy = true;

  try {
    const body = {
      json: {
        token: TOKEN,
        connected: radioConnected,
        freq: currentFreq,
        mode: currentMode,
        radio: "Flex 6600",
        version: "CAT TCP v6",
      }
    };

    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const respJson = await res.json();
      const data = respJson?.result?.data?.json;
      if (data && data.commands && data.commands.length > 0) {
        for (const cmd of data.commands) {
          if (cmd.action === "qsy" && cmd.freq) {
            sendQSY(cmd.freq);
          } else if (cmd.action === "split") {
            console.log("[SPLIT] RX:" + cmd.rxFreq + " TX:" + cmd.txFreq + " (non implemente)");
          }
        }
      }
    }
  } catch (err) {
    // Silent - retry next cycle
  } finally {
    pushBusy = false;
  }
}

// === Main ===

console.log("==========================================");
console.log("  DX HUNTER - CAT Bridge Relay v6");
console.log("  CAT: TCP " + CAT_HOST + ":" + CAT_PORT);
console.log("  Serveur: " + SERVER_URL);
console.log("  Token: " + TOKEN.substring(0, 8) + "...");
console.log("==========================================");
console.log("");

// Connect to SmartSDR CAT port
connectCAT();

// Push state to server periodically
setInterval(pushState, PUSH_INTERVAL_MS);
