#!/usr/bin/env node
/**
 * DX HUNTER — CAT Bridge Relay v7.5 (Kenwood CAT + SmartLink compatible)
 *
 * Architecture :
 * - TCP connection to SmartSDR CAT port (5001) via Kenwood protocol
 * - Compatible SmartLink (accès distant) car passe par SmartSDR Mac/Win
 * - Reads: VFO freq/mode, S-meter, power, SWR, filter width
 * - Executes: QSY, setpower, tune, mox, dsp (nb/nr/anf), setfilter, setrfgain
 * - TCP connection to Antenna Genius (port 9007, GSCP protocol) for antenna switching
 * - Pushes state to DX Hunter server via HTTP POST (tRPC relay)
 * - Receives commands from server in the POST response
 *
 * PAS de npm install requis. Node.js 18+ (fetch natif + net).
 *
 * Usage :
 *   node bridge-relay-v7.mjs
 *
 * Configuration (variables d'environnement) :
 *   SERVER_URL      — URL du serveur DX Hunter (défaut: https://dxclusterf4ivv.manus.space)
 *   TOKEN           — Token d'authentification (OBLIGATOIRE, 24 caractères minimum)
 *   CAT_HOST        — IP de SmartSDR (défaut: 127.0.0.1 = localhost)
 *   CAT_PORT        — Port CAT Kenwood de SmartSDR (défaut: 5001)
 *   AG_HOST         — IP de l'Antenna Genius (défaut: 127.0.0.1)
 *   AG_PORT         — Port Antenna Genius GSCP (défaut: 9007)
 *   AG_ENABLED      — Activer Antenna Genius (défaut: true)
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
const AG_HOST = process.env.AG_HOST || "127.0.0.1";
const AG_PORT = parseInt(process.env.AG_PORT || "9007");
const AG_ENABLED = (process.env.AG_ENABLED || "false") === "true";

const PUSH_INTERVAL_MS = 800;
const POLL_INTERVAL_MS = 700;
const RECONNECT_DELAY_MS = 5000;
const CAT_PUSH_URL = SERVER_URL + "/api/trpc/cat.push";
const ANT_PUSH_URL = SERVER_URL + "/api/trpc/antenna.push";
const VERBOSE = (process.env.VERBOSE || "false") === "true";

// ═══════════════════════════════════════════════════════════════════════════════
// RADIO STATE
// ═══════════════════════════════════════════════════════════════════════════════
let radioConnected = false;
let catSocket = null;
let rxBuffer = "";
let freqPollTimer = null;

// State
let currentFreq = 0;       // MHz
let currentMode = "";
let rfPower = 100;
let tuneActive = false;
let moxActive = false;
let nbEnabled = false;
let nrEnabled = false;
let anfEnabled = false;
let apfEnabled = false;
let rxAnt = "ANT1";
let txAnt = "ANT1";
let filterLo = 100;        // Hz
let filterHi = 2800;       // Hz
let rfGain = 0;            // dB
let rxPreset = "manual";
let eqEnabled = false;
let eqBands = [0, 0, 0, 0, 0, 0, 0, 0];

// Telemetry
let smeter = -127;         // dBm (from SM command)
let fwdPower = 0;          // Watts (from RM command)
let swr = 1.0;            // from RM command
let alc = 0;              // % from RM command
let paTemp = 0;           // °C (not available via Kenwood CAT)

// Pending response queue
let pendingQueries = [];
let queryTimer = null;

// ═══════════════════════════════════════════════════════════════════════════════
// ANTENNA GENIUS STATE
// ═══════════════════════════════════════════════════════════════════════════════
let agConnected = false;
let agSocket = null;
let agBuffer = "";
let agSelectedPort = 1;
let agPortCount = 4;
let agPortNames = ["Port 1", "Port 2", "Port 3", "Port 4"];
let agAutoBand = true;

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
    console.log(`[CAT] Connecté à ${CAT_HOST}:${CAT_PORT} (Kenwood CAT)`);
    radioConnected = true;
    // Start polling
    startPolling();
    // Request initial state — only commands SmartSDR supports
    setTimeout(() => {
      catWrite("IF;");  // Full info (freq + mode + tx state)
    }, 300);
    // Stagger subsequent requests to avoid overwhelming SmartSDR
    setTimeout(() => {
      catWrite("PC;");  // Power
    }, 600);
    setTimeout(() => {
      catWrite("NB;");  // Noise blanker
      catWrite("NR;");  // Noise reduction
      catWrite("NT;");  // ANF (notch)
    }, 900);
    setTimeout(() => {
      catWrite("SH;");  // Filter high
      catWrite("SL;");  // Filter low
    }, 1200);
  });
  catSocket.setEncoding("utf8");
  catSocket.setKeepAlive(true, 5000);
  catSocket.setTimeout(0); // Disable socket timeout — we handle keepalive ourselves

  catSocket.on("data", (data) => {
    rxBuffer += data;
    if (VERBOSE) console.log(`[CAT] RAW: ${data.replace(/\r?\n/g, "⏎")}`);
    let idx;
    while ((idx = rxBuffer.indexOf(";")) !== -1) {
      const msg = rxBuffer.slice(0, idx + 1).trim();
      rxBuffer = rxBuffer.slice(idx + 1);
      if (msg) handleCATResponse(msg);
    }
    // Reset keepalive timer on any data received
    resetKeepalive();
  });

  catSocket.on("timeout", () => {
    // Should not fire since timeout=0, but just in case
    console.log("[CAT] Socket timeout event");
  });

  catSocket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log(`[CAT] Port ${CAT_PORT} refuse — SmartSDR CAT actif ?`);
    } else {
      console.error("[CAT] Erreur:", err.message);
    }
  });

  catSocket.on("close", () => {
    if (radioConnected) console.log("[CAT] Déconnecté");
    radioConnected = false;
    catSocket = null;
    if (freqPollTimer) { clearInterval(freqPollTimer); freqPollTimer = null; }
    console.log(`[CAT] Reconnexion dans ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connectCAT, RECONNECT_DELAY_MS);
  });
}

function catWrite(cmd) {
  if (catSocket && catSocket.writable) {
    if (VERBOSE) console.log(`[CAT] TX: ${cmd}`);
    // SmartSDR CAT expects just the command with no extra CR/LF
    // Some implementations need \r, some need nothing after the ;
    catSocket.write(cmd);
  }
}

// ─── Keepalive: send IF; every 3s if no data received ───
let keepaliveTimer = null;
function resetKeepalive() {
  if (keepaliveTimer) clearTimeout(keepaliveTimer);
  keepaliveTimer = setTimeout(() => {
    if (catSocket && catSocket.writable) {
      catWrite("IF;");
      // If no response in 10s, reconnect
      keepaliveTimer = setTimeout(() => {
        console.log("[CAT] Pas de réponse keepalive, reconnexion...");
        if (catSocket) catSocket.destroy();
      }, 10000);
    }
  }, 3000);
}

function startPolling() {
  if (freqPollTimer) clearInterval(freqPollTimer);
  let pollCycle = 0;
  freqPollTimer = setInterval(() => {
    if (!catSocket || !catSocket.writable) return;
    // Only poll commands that SmartSDR actually supports
    // Avoid SM0, RM1, RM3, RM5, AG0 which return ?; and may cause disconnects
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
// CAT RESPONSE PARSING — Kenwood Protocol
// ═══════════════════════════════════════════════════════════════════════════════
function handleCATResponse(msg) {
  // ─── Ignore ?; responses (unsupported commands) ─────────────────────────────
  if (msg === "?" || msg === "?") {
    return; // SmartSDR returns ?; for unsupported commands — ignore silently
  }
  // ─── IF (Information) ─────────────────────────────────────────────────────────────
  // IF00014254999100+000000000002000000;
  // Pos 2-12: freq (11 digits, Hz)
  // Pos 28: TX status (0=RX, 1=TX)
  // Pos 29: mode code
  if (msg.startsWith("IF") && msg.length > 30) {
    const hzStr = msg.slice(2, 13);
    const hz = parseInt(hzStr, 10);
    if (!isNaN(hz) && hz > 0) {
      currentFreq = hz / 1000000;
    }
    // TX status at position 28
    const txStatus = msg.charAt(28);
    if (txStatus === "1") {
      moxActive = true;
    } else if (txStatus === "0") {
      moxActive = false;
      tuneActive = false; // If not TX, tune is off
    }
    // Mode code at position 29
    const modeCode = msg.charAt(29);
    currentMode = parseModeCode(modeCode);
  }
  // ─── FA (Frequency VFO A) ─────────────────────────────────────────────
  else if (msg.startsWith("FA") && !msg.startsWith("FA;") && msg.length >= 10) {
    const hzStr = msg.slice(2, -1);
    const hz = parseInt(hzStr, 10);
    if (!isNaN(hz) && hz > 0) {
      currentFreq = hz / 1000000;
    }
  }
  // ─── MD (Mode) ────────────────────────────────────────────────────────
  else if (msg.startsWith("MD") && !msg.startsWith("MD;") && msg.length >= 3) {
    const modeCode = msg.charAt(2);
    currentMode = parseModeCode(modeCode);
  }
  // ─── PC (Power Control) ───────────────────────────────────────────────
  // PC050; → 50W
  else if (msg.startsWith("PC") && !msg.startsWith("PC;") && msg.length >= 4) {
    const pw = parseInt(msg.slice(2, -1), 10);
    if (!isNaN(pw)) rfPower = pw;
  }
  // ─── SM (S-Meter) ─────────────────────────────────────────────────────
  // SM00150; → S-meter reading (0-0260 scale, where ~30 = S1, ~60 = S3, etc.)
  else if (msg.startsWith("SM") && msg.length >= 5) {
    const raw = parseInt(msg.slice(3, -1), 10);
    if (!isNaN(raw)) {
      // Convert Kenwood S-meter scale (0-260) to dBm approximation
      // S0=-127, S1=-121, S3=-109, S5=-97, S7=-85, S9=-73, S9+10=-63, S9+20=-53, S9+40=-33
      if (raw <= 0) smeter = -127;
      else if (raw <= 180) smeter = -127 + (raw / 180) * 54; // S0 to S9
      else smeter = -73 + ((raw - 180) / 80) * 40; // S9 to S9+40
    }
  }
  // ─── NB (Noise Blanker) ───────────────────────────────────────────────
  else if (msg.startsWith("NB") && !msg.startsWith("NB;") && msg.length >= 3) {
    nbEnabled = msg.charAt(2) === "1";
  }
  // ─── NR (Noise Reduction) ─────────────────────────────────────────────
  else if (msg.startsWith("NR") && !msg.startsWith("NR;") && msg.length >= 3) {
    nrEnabled = msg.charAt(2) === "1";
  }
  // ─── NT (Auto Notch Filter / ANF) ─────────────────────────────────────
  else if (msg.startsWith("NT") && !msg.startsWith("NT;") && msg.length >= 3) {
    anfEnabled = msg.charAt(2) === "1";
  }
  // ─── SH (Filter High) ─────────────────────────────────────────────────
  // SH07; → filter high cut index (SmartSDR maps index to Hz)
  // Index table (SSB): 01=1000, 02=1200, 03=1400, 04=1600, 05=1800, 06=2000,
  //   07=2200, 08=2400, 09=2600, 10=2800, 11=3000, 12=3200, 13=3400
  else if (msg.startsWith("SH") && !msg.startsWith("SH;") && msg.length >= 4) {
    const idx = parseInt(msg.slice(2), 10);
    if (!isNaN(idx)) {
      const shTable = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000];
      filterHi = idx < shTable.length ? shTable[idx] : idx * 200 + 600;
    }
  }
  // SL02; → filter low cut index
  // Index table (SSB): 00=0, 01=50, 02=100, 03=150, 04=200, 05=250, 06=300...
  else if (msg.startsWith("SL") && !msg.startsWith("SL;") && msg.length >= 4) {
    const idx = parseInt(msg.slice(2), 10);
    if (!isNaN(idx)) {
      filterLo = idx * 50;
    }
  }
  // ─── AG (AF/RF Gain) ──────────────────────────────────────────────────
  // AG0200; → gain level 0-255
  else if (msg.startsWith("AG") && !msg.startsWith("AG;") && msg.length >= 5) {
    const val = parseInt(msg.slice(3, -1), 10);
    if (!isNaN(val)) {
      // Map 0-255 to -8 to +32 dB range (Flex RF gain)
      rfGain = Math.round((val / 255) * 40 - 8);
    }
  }
  // ─── RM (Read Meter) ──────────────────────────────────────────────────
  // RM1xxxx; → SWR meter
  // RM3xxxx; → ALC meter
  // RM5xxxx; → Forward power meter
  else if (msg.startsWith("RM") && msg.length >= 6) {
    const meterType = msg.charAt(2);
    const raw = parseInt(msg.slice(3, -1), 10);
    if (!isNaN(raw)) {
      switch (meterType) {
        case "1": // SWR: 0-260 scale, map to 1.0-5.0
          swr = 1.0 + (raw / 260) * 4.0;
          swr = Math.round(swr * 10) / 10;
          break;
        case "3": // ALC: 0-260 scale, map to 0-100%
          alc = Math.round((raw / 260) * 100);
          break;
        case "5": // Forward power: 0-260 scale, map to 0-rfPower watts
          fwdPower = Math.round((raw / 260) * rfPower);
          break;
      }
    }
  }
  // ─── TX/RX status ─────────────────────────────────────────────────────
  else if (msg === "TX0;" || msg === "TX1;") {
    moxActive = msg === "TX1;";
  }
  else if (msg === "RX;") {
    moxActive = false;
    tuneActive = false;
  }
}

function parseModeCode(code) {
  switch (code) {
    case "1": return "LSB";
    case "2": return "USB";
    case "3": return "CW";
    case "4": return "FM";
    case "5": return "AM";
    case "6": return "DIGU";
    case "7": return "CW-R";
    case "9": return "DIGL";
    default: return currentMode || "USB";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND EXECUTION — Kenwood CAT (with deduplication)
// ═══════════════════════════════════════════════════════════════════════════════
const processedCmdIds = new Set();
const MAX_PROCESSED_IDS = 200;

function executeCommand(cmd) {
  // Deduplicate: server keeps commands for 30s, bridge polls every 800ms
  // Without this, the same QSY would be re-applied ~37 times
  if (cmd.id && processedCmdIds.has(cmd.id)) return;
  if (cmd.id) {
    processedCmdIds.add(cmd.id);
    if (processedCmdIds.size > MAX_PROCESSED_IDS) {
      const first = processedCmdIds.values().next().value;
      processedCmdIds.delete(first);
    }
  }

  if (!radioConnected) {
    console.log(`[CAT] Commande ignorée (non connecté): ${cmd.action}`);
    return;
  }
  try {
    switch (cmd.action) {
      case "qsy":
        if (cmd.freq) {
          const hz = Math.round(cmd.freq * 1000000);
          const faCmd = "FA" + hz.toString().padStart(11, "0") + ";";
          console.log(`[CAT] QSY → ${cmd.freq.toFixed(3)} MHz (${faCmd})`);
          catWrite(faCmd);
          if (cmd.mode) {
            const modeCmd = "MD" + modeToCode(cmd.mode, cmd.freq) + ";";
            catWrite(modeCmd);
          }
          // Confirm after short delay
          setTimeout(() => catWrite("IF;"), 300);
        }
        break;

      case "setpower":
        if (cmd.value !== undefined) {
          const pw = Math.max(0, Math.min(100, Math.round(cmd.value)));
          console.log(`[CAT] RF Power → ${pw}W`);
          catWrite("PC" + pw.toString().padStart(3, "0") + ";");
          rfPower = pw;
        }
        break;

      case "tune":
        if (cmd.enabled) {
          console.log("[CAT] TUNE ON");
          // Flex via Kenwood: AC command for antenna tuner, or use MN073 menu
          // Most reliable: set low power + TX
          catWrite("AC111;"); // Antenna tuner ON + start tune
          tuneActive = true;
        } else {
          console.log("[CAT] TUNE OFF");
          catWrite("AC110;"); // Stop tune
          catWrite("RX;");
          tuneActive = false;
        }
        break;

      case "mox":
        if (cmd.enabled) {
          console.log("[CAT] MOX ON (TX)");
          catWrite("TX;");
          moxActive = true;
        } else {
          console.log("[CAT] MOX OFF (RX)");
          catWrite("RX;");
          moxActive = false;
        }
        break;

      case "dsp":
        if (cmd.param && cmd.enabled !== undefined) {
          console.log(`[CAT] DSP ${cmd.param} → ${cmd.enabled ? "ON" : "OFF"}`);
          const val = cmd.enabled ? "1" : "0";
          switch (cmd.param) {
            case "nb": catWrite("NB" + val + ";"); nbEnabled = cmd.enabled; break;
            case "nr": catWrite("NR" + val + ";"); nrEnabled = cmd.enabled; break;
            case "anf": catWrite("NT" + val + ";"); anfEnabled = cmd.enabled; break;
          }
        }
        break;

      case "apf":
        // APF not directly available via Kenwood CAT on Flex
        console.log(`[CAT] APF ${cmd.enabled ? "ON" : "OFF"} (non supporté via CAT Kenwood)`);
        apfEnabled = cmd.enabled || false;
        break;

      case "setfilter":
        if (cmd.filterLo !== undefined && cmd.filterHi !== undefined) {
          console.log(`[CAT] Filtre → ${cmd.filterLo}-${cmd.filterHi} Hz`);
          // SmartSDR CAT accepts SH/SL with Hz values directly
          catWrite("SL" + cmd.filterLo.toString().padStart(4, "0") + ";");
          catWrite("SH" + cmd.filterHi.toString().padStart(4, "0") + ";");
          filterLo = cmd.filterLo;
          filterHi = cmd.filterHi;
        }
        break;

      case "setrfgain":
        if (cmd.rfGain !== undefined) {
          // Map -8 to +32 dB to 0-255 Kenwood scale
          const mapped = Math.round(((cmd.rfGain + 8) / 40) * 255);
          const clamped = Math.max(0, Math.min(255, mapped));
          console.log(`[CAT] RF Gain → ${cmd.rfGain} dB (AG0${clamped})`);
          catWrite("AG0" + clamped.toString().padStart(3, "0") + ";");
          rfGain = cmd.rfGain;
        }
        break;

      case "seteq":
        // EQ not available via Kenwood CAT protocol
        console.log("[CAT] EQ non supporté via protocole Kenwood CAT");
        if (cmd.eqBands) eqBands = cmd.eqBands;
        break;

      case "setpreset":
        if (cmd.preset) {
          console.log(`[CAT] Preset RX → ${cmd.preset}`);
          rxPreset = cmd.preset;
        }
        break;

      case "setant":
        // Antenna selection not directly via Kenwood CAT
        // But we can try AN command if supported
        if (cmd.ant && cmd.type) {
          console.log(`[CAT] Antenne ${cmd.type} → ${cmd.ant} (tentative via AN)`);
          // Try Kenwood AN command: AN1 = ANT1, AN2 = ANT2
          const antNum = cmd.ant.replace(/\D/g, "") || "1";
          catWrite("AN" + antNum + ";");
          if (cmd.type === "rxant") rxAnt = cmd.ant;
          if (cmd.type === "txant") txAnt = cmd.ant;
        }
        break;

      case "spot":
        // Spots on panadapter not available via Kenwood CAT
        console.log(`[CAT] Spot pan: ${cmd.callsign} @ ${cmd.freq} MHz (non supporté via CAT)`);
        break;

      case "clearspots":
        console.log("[CAT] Clear spots (non supporté via CAT)");
        break;

      default:
        console.log(`[CAT] Commande inconnue: ${cmd.action}`);
    }
  } catch (err) {
    console.error(`[CAT] Erreur commande ${cmd.action}:`, err.message);
  }
}

function modeToCode(mode, freqMHz) {
  const m = (mode || "").toUpperCase();
  if (m === "SSB" || m === "PHONE") return freqMHz < 10 ? "1" : "2";
  if (m === "LSB") return "1";
  if (m === "USB") return "2";
  if (m === "CW") return "3";
  if (m === "FM") return "4";
  if (m === "AM") return "5";
  if (m === "DIGU" || m === "FT8" || m === "FT4" || m === "DIGITAL") return "6";
  if (m === "CW-R") return "7";
  if (m === "DIGL") return "9";
  return freqMHz < 10 ? "1" : "2";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANTENNA GENIUS — GSCP Protocol (port 9007)
// ═══════════════════════════════════════════════════════════════════════════════
function connectAntennaGenius() {
  if (!AG_ENABLED) return;
  if (agSocket) {
    try { agSocket.destroy(); } catch {}
    agSocket = null;
  }
  console.log(`[AG] Connexion à ${AG_HOST}:${AG_PORT}...`);
  agSocket = net.createConnection(AG_PORT, AG_HOST, () => {
    console.log(`[AG] Connecté à ${AG_HOST}:${AG_PORT}`);
    agConnected = true;
    // Request initial state
    agSend("STATUS");
    agSend("PORTCOUNT");
    agSend("PORTNAMES");
  });
  agSocket.setEncoding("utf8");
  agSocket.setKeepAlive(true, 10000);

  agSocket.on("data", (data) => {
    agBuffer += data;
    const lines = agBuffer.split("\r\n");
    agBuffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) handleAgLine(line.trim());
    }
  });

  agSocket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log(`[AG] Port ${AG_PORT} refuse — Antenna Genius actif ?`);
    } else {
      console.error("[AG] Erreur:", err.message);
    }
  });

  agSocket.on("close", () => {
    if (agConnected) console.log("[AG] Déconnecté");
    agConnected = false;
    agSocket = null;
    console.log(`[AG] Reconnexion dans ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connectAntennaGenius, RECONNECT_DELAY_MS);
  });
}

function handleAgLine(line) {
  if (line.startsWith("PORT:")) {
    agSelectedPort = parseInt(line.slice(5)) || 1;
  } else if (line.startsWith("PORTCOUNT:")) {
    agPortCount = parseInt(line.slice(10)) || 4;
  } else if (line.startsWith("PORTNAMES:")) {
    agPortNames = line.slice(10).split(",").map(s => s.trim());
  } else if (line.startsWith("AUTO:")) {
    agAutoBand = line.slice(5).toUpperCase() === "ON";
  } else if (line.includes("PORT:") && line.includes(",")) {
    const portMatch = line.match(/PORT:(\d+)/);
    if (portMatch) agSelectedPort = parseInt(portMatch[1]);
    const autoMatch = line.match(/AUTO:(ON|OFF)/i);
    if (autoMatch) agAutoBand = autoMatch[1].toUpperCase() === "ON";
  }
}

function agSend(cmd) {
  if (agSocket && agSocket.writable) {
    agSocket.write(cmd + "\r\n");
  }
}

function executeAgCommand(cmd) {
  if (!agConnected) {
    console.log(`[AG] Commande ignorée (non connecté): ${cmd.action}`);
    return;
  }
  switch (cmd.action) {
    case "select":
      if (cmd.port) {
        console.log(`[AG] Sélection port ${cmd.port}`);
        agSend(`PORT ${cmd.port}`);
        agSelectedPort = cmd.port;
      }
      break;
    case "autoband":
      console.log(`[AG] Auto-band ${cmd.enabled ? "ON" : "OFF"}`);
      agSend(`AUTO ${cmd.enabled ? "ON" : "OFF"}`);
      agAutoBand = cmd.enabled;
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP PUSH TO SERVER
// ═══════════════════════════════════════════════════════════════════════════════
let pushBusy = false;
let antPushBusy = false;
let serverReachable = false;
let pushFailures = 0;
let lastPushError = "";

async function pushCatState() {
  if (pushBusy) return;
  pushBusy = true;
  try {
    const body = {
      json: {
        token: TOKEN,
        connected: radioConnected,
        freq: currentFreq,
        mode: currentMode,
        radio: "FlexRadio (SmartLink)",
        version: "CAT Kenwood v7.5",
        // Flex control
        rfPower,
        tuneActive,
        moxActive,
        nbEnabled,
        nrEnabled,
        anfEnabled,
        apfEnabled,
        rxAnt,
        txAnt,
        // RX Filter
        filterLo,
        filterHi,
        rfGain,
        rxPreset,
        // EQ
        eqEnabled,
        eqBands,
        // Telemetry
        smeter,
        fwdPower,
        swr,
        alc,
        paTemp,
      }
    };
    const res = await fetch(CAT_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    }
    const respJson = await res.json();
    const data = respJson?.result?.data?.json;
    if (!serverReachable) {
      console.log(`[Serveur] Connecté à ${SERVER_URL} — état CAT transmis`);
    }
    serverReachable = true;
    pushFailures = 0;
    lastPushError = "";
    if (data && data.commands && data.commands.length > 0) {
      for (const cmd of data.commands) {
        executeCommand(cmd);
      }
    }
  } catch (err) {
    pushFailures++;
    const message = err?.message || String(err);
    if (serverReachable || message !== lastPushError || pushFailures % 10 === 0) {
      console.error(`[Serveur] Push impossible (${pushFailures}) : ${message}`);
    }
    serverReachable = false;
    lastPushError = message;
  } finally {
    pushBusy = false;
  }
}

async function pushAntennaState() {
  if (!AG_ENABLED || antPushBusy) return;
  antPushBusy = true;
  try {
    const body = {
      json: {
        token: TOKEN,
        connected: agConnected,
        selectedPort: agSelectedPort,
        portCount: agPortCount,
        portNames: agPortNames,
        autoBand: agAutoBand,
      }
    };
    const res = await fetch(ANT_PUSH_URL, {
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
          executeAgCommand(cmd);
        }
      }
    }
  } catch (err) {
    // Silent retry
  } finally {
    antPushBusy = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  DX HUNTER — Bridge Relay v7.5 (Kenwood CAT + SmartLink)   ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  CAT        : ${CAT_HOST}:${CAT_PORT} (Kenwood protocol)`.padEnd(64) + "║");
if (AG_ENABLED) {
  console.log(`║  Ant Genius : ${AG_HOST}:${AG_PORT}`.padEnd(64) + "║");
} else {
  console.log("║  Ant Genius : DÉSACTIVÉ".padEnd(64) + "║");
}
console.log(`║  Serveur    : ${SERVER_URL}`.padEnd(64) + "║");
console.log(`║  Token      : ${TOKEN.substring(0, 8)}...`.padEnd(64) + "║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Fonctions (via Kenwood CAT) :                             ║");
console.log("║    ✓ Fréquence, mode, QSY                                  ║");
console.log("║    ✓ Power (PC), TUNE (AC), MOX (TX/RX)                    ║");
console.log("║    ✓ DSP : NB, NR, ANF                                     ║");
console.log("║    ✓ Filtre passe-bande (SL/SH)                            ║");
console.log("║    ✓ RF Gain (AG)                                           ║");
console.log("║    ✓ Télémétrie : S-mètre (SM), Power (RM5), SWR (RM1)    ║");
console.log("║    ✗ APF, EQ 8 bandes (non dispo via Kenwood CAT)          ║");
console.log("║    ✗ Spots panadapter (non dispo via Kenwood CAT)           ║");
console.log("║    ✗ Sélection antenne RX/TX (limité)                       ║");
if (AG_ENABLED) {
  console.log("║    ✓ Antenna Genius : commutation ports, auto-band         ║");
}
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");
console.log("[Info] Compatible SmartLink — passe par SmartSDR Mac/Win port 5001");
console.log("");

// Connect to SmartSDR CAT port
connectCAT();

// Connect to Antenna Genius
if (AG_ENABLED) {
  setTimeout(connectAntennaGenius, 1000);
}

// Push state to server periodically
setInterval(pushCatState, PUSH_INTERVAL_MS);
if (AG_ENABLED) {
  setInterval(pushAntennaState, 2000);
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bridge] Arrêt...");
  if (catSocket) catSocket.destroy();
  if (agSocket) agSocket.destroy();
  process.exit(0);
});
process.on("SIGTERM", () => {
  if (catSocket) catSocket.destroy();
  if (agSocket) agSocket.destroy();
  process.exit(0);
});
