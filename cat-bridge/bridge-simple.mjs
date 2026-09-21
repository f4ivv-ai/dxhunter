/**
 * DX HUNTER — Bridge Simple v1.0 (1 VFO — CAT Only)
 *
 * Mode simple : un seul panadapteur suffit.
 * Basé sur le bridge v7 qui fonctionnait parfaitement avec SmartSDR.
 *
 * Polling : IF; PC; IF; NB; (pas de FA;, pas de FB;, pas de SM0;)
 * Compatible SmartLink (accès distant via SmartSDR Mac/Win).
 *
 * PAS de npm install requis. Node.js 18+ (fetch natif + net).
 *
 * Usage :
 *   node bridge-simple.mjs
 *
 * Configuration (variables d'environnement) :
 *   SERVER_URL  — URL du serveur DX Hunter
 *   TOKEN       — Token d'authentification
 *   CAT_HOST    — IP de SmartSDR (défaut: 127.0.0.1)
 *   CAT_PORT    — Port CAT Kenwood de SmartSDR (défaut: 5001)
 *   VERBOSE     — Afficher les commandes CAT (défaut: false)
 */

import net from "node:net";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const SERVER_URL = process.env.SERVER_URL || "https://dxclusterf4ivv.manus.space";
const TOKEN = process.env.TOKEN;
if (!TOKEN || TOKEN.length < 24) {
  console.error("ERREUR : définissez TOKEN (24 caractères minimum), identique à CAT_BRIDGE_TOKEN côté serveur.");
  process.exit(1);
}
const CAT_HOST = process.env.CAT_HOST || "127.0.0.1";
const CAT_PORT = parseInt(process.env.CAT_PORT || "5001");
const VERBOSE = (process.env.VERBOSE || "false") === "true";

const POLL_INTERVAL_MS = 700;
const PUSH_INTERVAL_MS = 800;
const RECONNECT_DELAY_MS = 5000;
const PUSH_URL = SERVER_URL + "/api/trpc/cat.push";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

let currentFreq = 0;
let currentMode = "";
let radioConnected = false;
let rfPower = 100;
let nbEnabled = false;
let nrEnabled = false;
let anfEnabled = false;
let eqEnabled = false;
let filterLo = 100;
let filterHi = 2800;
let txActive = false;

let catSocket = null;
let rxBuffer = "";
let pushBusy = false;
let freqPollTimer = null;
let keepaliveTimer = null;

// ═══════════════════════════════════════════════════════════════════════════════
// CAT CONNECTION — Kenwood Protocol via SmartSDR port 5001
// ═══════════════════════════════════════════════════════════════════════════════

function connectCAT() {
  if (catSocket) {
    try { catSocket.destroy(); } catch {}
    catSocket = null;
  }

  console.log(`[CAT] Connexion à ${CAT_HOST}:${CAT_PORT}...`);

  catSocket = net.createConnection(CAT_PORT, CAT_HOST, () => {
    console.log(`[CAT] ✅ Connecté à ${CAT_HOST}:${CAT_PORT}`);
    radioConnected = true;
    rxBuffer = "";
    // Start polling
    startPolling();
    // Request initial state — only commands SmartSDR supports
    setTimeout(() => catWrite("IF;"), 300);
    setTimeout(() => catWrite("PC;"), 600);
    setTimeout(() => {
      catWrite("NB;");
      catWrite("NR;");
      catWrite("NT;");
    }, 900);
    setTimeout(() => {
      catWrite("SH;");
      catWrite("SL;");
    }, 1200);
  });

  catSocket.setEncoding("utf8");
  catSocket.setKeepAlive(true, 5000);

  catSocket.on("data", (data) => {
    resetKeepalive();
    rxBuffer += data;
    let idx;
    while ((idx = rxBuffer.indexOf(";")) !== -1) {
      const msg = rxBuffer.slice(0, idx).trim();
      rxBuffer = rxBuffer.slice(idx + 1);
      if (msg) handleCATResponse(msg);
    }
  });

  catSocket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log(`[CAT] Connexion refusée — SmartSDR démarré ?`);
    } else {
      console.error("[CAT] Erreur:", err.message);
    }
  });

  catSocket.on("close", () => {
    if (radioConnected) console.log("[CAT] Déconnecté");
    radioConnected = false;
    catSocket = null;
    if (freqPollTimer) { clearInterval(freqPollTimer); freqPollTimer = null; }
    if (keepaliveTimer) { clearTimeout(keepaliveTimer); keepaliveTimer = null; }
    console.log(`[CAT] Reconnexion dans ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connectCAT, RECONNECT_DELAY_MS);
  });
}

function catWrite(cmd) {
  if (catSocket && catSocket.writable) {
    if (VERBOSE) console.log(`[CAT →] ${cmd}`);
    catSocket.write(cmd);
  }
}

// ─── Keepalive: send IF; every 3s if no data received ───
function resetKeepalive() {
  if (keepaliveTimer) clearTimeout(keepaliveTimer);
  keepaliveTimer = setTimeout(() => {
    if (catSocket && catSocket.writable) {
      catWrite("IF;");
      keepaliveTimer = setTimeout(() => {
        console.log("[CAT] Pas de réponse keepalive, reconnexion...");
        if (catSocket) catSocket.destroy();
      }, 10000);
    }
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLLING — Only safe commands (IF, PC, NB) — NO FA, NO FB, NO SM0
// ═══════════════════════════════════════════════════════════════════════════════

function startPolling() {
  if (freqPollTimer) clearInterval(freqPollTimer);
  let pollCycle = 0;
  freqPollTimer = setInterval(() => {
    if (!catSocket || !catSocket.writable) return;
    // Only poll commands that SmartSDR actually supports with 1 slice
    switch (pollCycle % 4) {
      case 0: catWrite("IF;"); break;      // Full info (freq + mode + TX)
      case 1: catWrite("PC;"); break;      // Power level
      case 2: catWrite("IF;"); break;      // Freq again (keepalive)
      case 3: catWrite("NB;"); break;      // NB state
    }
    pollCycle++;
  }, POLL_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAT RESPONSE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function handleCATResponse(msg) {
  // Ignore unsupported command responses
  if (msg === "?" || msg === "") return;
  if (VERBOSE) console.log(`[CAT ←] ${msg}`);

  // IF — Information (freq + mode + TX state)
  // IF00014254999100+000000000002000000;
  if (msg.startsWith("IF") && msg.length >= 30) {
    const hzStr = msg.slice(2, 13);
    const hz = parseInt(hzStr, 10);
    if (!isNaN(hz) && hz > 0) {
      const freqMHz = hz / 1000000;
      if (Math.abs(freqMHz - currentFreq) > 0.0001) {
        currentFreq = freqMHz;
        console.log(`[FREQ] ${freqMHz.toFixed(3)} MHz ${currentMode}`);
      }
    }
    // Mode code at position 29
    if (msg.length > 29) {
      const modeCode = msg[29];
      const modes = { "1": "LSB", "2": "USB", "3": "CW", "4": "FM", "5": "AM", "6": "RTTY", "7": "CW-R", "9": "FSK" };
      if (modes[modeCode]) currentMode = modes[modeCode];
    }
    // TX state at position 28
    if (msg.length > 28) {
      txActive = msg[28] === "1";
    }
  }
  // FA — Frequency (fallback if SmartSDR sends it)
  else if (msg.startsWith("FA") && msg.length >= 13) {
    const hz = parseInt(msg.slice(2), 10);
    if (!isNaN(hz) && hz > 0) {
      currentFreq = hz / 1000000;
    }
  }
  // MD — Mode
  else if (msg.startsWith("MD") && msg.length >= 3) {
    const modeCode = msg[2];
    const modes = { "1": "LSB", "2": "USB", "3": "CW", "4": "FM", "5": "AM", "6": "RTTY", "7": "CW-R", "9": "FSK" };
    if (modes[modeCode]) currentMode = modes[modeCode];
  }
  // PC — Power
  else if (msg.startsWith("PC") && msg.length >= 5) {
    const pw = parseInt(msg.slice(2), 10);
    if (!isNaN(pw)) rfPower = pw;
  }
  // NB — Noise Blanker
  else if (msg.startsWith("NB") && msg.length >= 3) {
    nbEnabled = msg[2] === "1";
  }
  // NR — Noise Reduction
  else if (msg.startsWith("NR") && msg.length >= 3) {
    nrEnabled = msg[2] === "1";
  }
  // NT — ANF (Notch)
  else if (msg.startsWith("NT") && msg.length >= 3) {
    anfEnabled = msg[2] === "1";
  }
  // SL — Filter Low
  else if (msg.startsWith("SL") && msg.length >= 4) {
    const idx = parseInt(msg.slice(2), 10);
    if (!isNaN(idx)) filterLo = idx * 50;
  }
  // SH — Filter High
  else if (msg.startsWith("SH") && msg.length >= 4) {
    const idx = parseInt(msg.slice(2), 10);
    if (!isNaN(idx)) filterHi = idx === 0 ? 1000 : 1000 + (idx - 1) * 200 + 200;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH TO SERVER
// ═══════════════════════════════════════════════════════════════════════════════

async function pushToServer() {
  if (pushBusy) return;
  pushBusy = true;

  if (!currentMode && currentFreq > 0) {
    currentMode = currentFreq < 10 ? "LSB" : "USB";
  }

  const payload = {
    token: TOKEN,
    connected: radioConnected,
    freq: currentFreq,
    mode: currentMode,
    radio: "Flex 6600",
    version: "Simple v1.0",
    so2r: false,
    rfPower,
    nbEnabled,
    nrEnabled,
    anfEnabled,
    eqEnabled,
    filterLo,
    filterHi,
    smeter: 0,
  };

  try {
    const resp = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: payload }),
      signal: AbortSignal.timeout(4000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const result = data?.result?.data?.json;
      if (result?.commands?.length) {
        for (const cmd of result.commands) {
          handleServerCommand(cmd);
        }
      }
    }
  } catch (err) {
    if (VERBOSE) console.log(`[PUSH] Erreur: ${err.message}`);
  } finally {
    pushBusy = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLING (from server/UI)
// ═══════════════════════════════════════════════════════════════════════════════

// Track processed command IDs to avoid duplicates (server keeps commands for 30s)
const processedCmdIds = new Set();
const MAX_PROCESSED_IDS = 100;

function handleServerCommand(cmd) {
  // Deduplicate: skip if already processed
  if (cmd.id && processedCmdIds.has(cmd.id)) return;
  if (cmd.id) {
    processedCmdIds.add(cmd.id);
    // Keep set bounded
    if (processedCmdIds.size > MAX_PROCESSED_IDS) {
      const first = processedCmdIds.values().next().value;
      processedCmdIds.delete(first);
    }
  }
  const { action } = cmd;

  switch (action) {
    case "qsy":
    case "qsy_run":
    case "qsy_multi":
    case "swap_and_qsy": {
      // All QSY variants → QSY the single VFO
      const freq = cmd.freq;
      if (!freq) break;
      const hz = Math.round(freq * 1000000);
      const hzStr = hz.toString().padStart(11, "0");
      catWrite(`FA${hzStr};`);
      console.log(`[QSY] → ${freq.toFixed(3)} MHz`);
      if (cmd.mode) {
        const modeMap = { "LSB": "MD1;", "USB": "MD2;", "CW": "MD3;", "FM": "MD4;", "AM": "MD5;", "CW-R": "MD7;", "FSK": "MD9;" };
        const modeCmd = modeMap[cmd.mode.toUpperCase()];
        if (modeCmd) setTimeout(() => catWrite(modeCmd), 100);
      }
      // Confirm with IF; after short delay
      setTimeout(() => catWrite("IF;"), 300);
      break;
    }

    case "swap":
      console.log("[SWAP] Ignoré — mode simple (1 VFO)");
      break;

    case "setpower": {
      const val = cmd.value;
      if (val !== undefined) {
        catWrite(`PC${val.toString().padStart(3, "0")};`);
        console.log(`[POWER] → ${val}W`);
      }
      break;
    }

    case "tune": {
      if (cmd.enabled === false) {
        catWrite("RX;");
        console.log(`[TUNE] STOP`);
      } else {
        catWrite("TX;");
        console.log(`[TUNE] START`);
        setTimeout(() => {
          catWrite("RX;");
          console.log(`[TUNE] Auto-stop (10s safety)`);
        }, 10000);
      }
      break;
    }

    case "mox": {
      catWrite(cmd.enabled ? "TX;" : "RX;");
      console.log(`[MOX] → ${cmd.enabled ? "TX" : "RX"}`);
      break;
    }

    case "dsp": {
      const param = cmd.param;
      const enabled = cmd.enabled;
      if (param === "nb") {
        catWrite(`NB${enabled ? "1" : "0"};`);
        console.log(`[DSP] NB → ${enabled ? "ON" : "OFF"}`);
      } else if (param === "nr") {
        catWrite(`NR${enabled ? "1" : "0"};`);
        console.log(`[DSP] NR → ${enabled ? "ON" : "OFF"}`);
      } else if (param === "anf") {
        catWrite(`NT${enabled ? "1" : "0"};`);
        console.log(`[DSP] ANF → ${enabled ? "ON" : "OFF"}`);
      } else if (param === "eq") {
        catWrite(`EQ${enabled ? "1" : "0"};`);
        console.log(`[DSP] EQ → ${enabled ? "ON" : "OFF"}`);
      }
      break;
    }

    case "setfilter": {
      const lo = cmd.filterLo;
      const hi = cmd.filterHi;
      if (lo !== undefined) {
        const slIdx = Math.round(lo / 50);
        catWrite(`SL${slIdx.toString().padStart(2, "0")};`);
      }
      if (hi !== undefined) {
        let shIdx = 0;
        if (hi <= 1000) shIdx = 0;
        else shIdx = Math.round((hi - 1000) / 200) + 1;
        catWrite(`SH${shIdx.toString().padStart(2, "0")};`);
      }
      if (lo !== undefined || hi !== undefined) {
        console.log(`[FILTER] Lo: ${lo ?? "—"} Hz | Hi: ${hi ?? "—"} Hz`);
      }
      break;
    }

    case "setpreset": {
      const preset = cmd.preset;
      const presets = {
        "ssb-large": { lo: 50, hi: 3000 },
        "ssb-dx": { lo: 100, hi: 2700 },
        "ssb-narrow": { lo: 200, hi: 2400 },
        "cw-wide": { lo: 300, hi: 900 },
        "cw-narrow": { lo: 400, hi: 700 },
      };
      const p = presets[preset];
      if (p) {
        handleServerCommand({ action: "setfilter", filterLo: p.lo, filterHi: p.hi });
        console.log(`[PRESET] ${preset} → ${p.lo}-${p.hi} Hz`);
      }
      break;
    }

    default:
      if (VERBOSE) console.log(`[CMD] Commande inconnue: ${action}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  DX HUNTER — Bridge Simple v1.0 (1 VFO)                    ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  Port CAT     : ${CAT_HOST}:${CAT_PORT}`.padEnd(64) + "║");
console.log(`║  Polling      : IF; PC; NB; (safe, pas de FA/FB/SM0)`.padEnd(64) + "║");
console.log(`║  Serveur      : ${SERVER_URL}`.padEnd(64) + "║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Mode simple : 1 seul panadapteur suffit                   ║");
console.log("║  Commandes   : QSY, Filtre, DSP, EQ, Puissance, TX        ║");
console.log("║  PAS de SO2V : pas de SWAP, pas de MULTI                   ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");
console.log("Ctrl+C pour arrêter");
console.log("");

// Connect CAT
connectCAT();

// Start push loop
setInterval(pushToServer, PUSH_INTERVAL_MS);

// Status display every 10s
setInterval(() => {
  if (!radioConnected) {
    console.log(`[Bridge] ⚪ Déconnecté — en attente de SmartSDR...`);
    return;
  }
  console.log(`[Simple] 🟢 ${currentFreq.toFixed(3)} MHz ${currentMode} | PWR: ${rfPower}W${txActive ? " 📡TX" : ""}`);
}, 10000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bridge] Arrêt...");
  if (catSocket) catSocket.destroy();
  process.exit(0);
});
