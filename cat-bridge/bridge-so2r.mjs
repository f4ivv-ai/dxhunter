#!/usr/bin/env node
/**
 * DX HUNTER — Bridge SO2R v1.0 (Dual FlexRadio via SmartSDR Kenwood CAT)
 *
 * Architecture :
 * - Connexion simultanée à 2 instances SmartSDR (port A + port B)
 * - Chaque radio a un rôle : RUN (émission) ou MULTI (écoute/recherche)
 * - Interlock TX logiciel : un seul poste émet à la fois
 * - Push HTTP vers DX Hunter avec état dual complet
 * - Commandes ciblées : QSY cluster → MULTI, SWAP, PTT
 *
 * Usage :
 *   PORT_A=5001 PORT_B=5002 node bridge-so2r.mjs
 *
 * Env vars :
 *   CAT_HOST       : IP SmartSDR (défaut 127.0.0.1)
 *   PORT_A         : Port CAT radio A (défaut 5001)
 *   PORT_B         : Port CAT radio B (défaut 5002)
 *   NAME_A         : Nom radio A (défaut "Flex 6401")
 *   NAME_B         : Nom radio B (défaut "Flex 8600")
 *   INITIAL_RUN    : Radio initiale en RUN (A ou B, défaut A)
 *   SERVER_URL     : URL DX Hunter (défaut https://dxclusterf4ivv.manus.space)
 *   TOKEN          : Token bridge (OBLIGATOIRE, 24 caractères minimum)
 *   PUSH_INTERVAL  : Intervalle push ms (défaut 800)
 *   POLL_INTERVAL  : Intervalle polling CAT ms (défaut 1500)
 *   VERBOSE        : Afficher toutes les commandes/réponses (défaut false)
 */

import net from "net";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CAT_HOST = process.env.CAT_HOST || "127.0.0.1";
const PORT_A = parseInt(process.env.PORT_A || "5001", 10);
const PORT_B = parseInt(process.env.PORT_B || "5002", 10);
const NAME_A = process.env.NAME_A || "Flex 6401";
const NAME_B = process.env.NAME_B || "Flex 8600";
const INITIAL_RUN = (process.env.INITIAL_RUN || "A").toUpperCase();

const SERVER_URL = (process.env.SERVER_URL || "https://dxclusterf4ivv.manus.space").replace(/\/$/, "");
const TOKEN = process.env.TOKEN;
if (!TOKEN || TOKEN.length < 24) {
  console.error("ERREUR : définissez TOKEN (24 caractères minimum), identique à CAT_BRIDGE_TOKEN côté serveur.");
  process.exit(1);
}
const PUSH_INTERVAL = parseInt(process.env.PUSH_INTERVAL || "800", 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "1500", 10);
const VERBOSE = process.env.VERBOSE === "true";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

// Roles
let roles = { run: INITIAL_RUN === "B" ? "B" : "A", multi: INITIAL_RUN === "B" ? "A" : "B" };

// Radio state (one per radio)
function createRadioState(name) {
  return {
    name,
    connected: false,
    freq: 0,
    mode: "",
    tx: false,
    rfPower: 100,
    nbEnabled: false,
    nrEnabled: false,
    anfEnabled: false,
    filterLo: 100,
    filterHi: 2800,
  };
}

const radioA = createRadioState(NAME_A);
const radioB = createRadioState(NAME_B);

// Sockets
let socketA = null;
let socketB = null;
let bufferA = "";
let bufferB = "";
let pollTimerA = null;
let pollTimerB = null;
let reconnectTimerA = null;
let reconnectTimerB = null;

// ═══════════════════════════════════════════════════════════════════════════════
// INTERLOCK TX
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interlock rule: only the RUN radio can transmit.
 * If MULTI tries to TX, block it immediately.
 */
function checkInterlock(radioId, wantsTx) {
  if (!wantsTx) return true; // RX is always allowed
  
  const isRun = roles.run === radioId;
  if (!isRun) {
    console.log(`[INTERLOCK] ⚠️  Radio ${radioId} (MULTI) tentative TX bloquée !`);
    // Send RX command to force back
    catWrite(radioId, "RX;");
    return false;
  }
  
  // Check other radio is not transmitting
  const other = radioId === "A" ? radioB : radioA;
  if (other.tx) {
    console.log(`[INTERLOCK] ⚠️  Radio ${radioId} TX bloqué — l'autre radio émet encore !`);
    return false;
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWAP
// ═══════════════════════════════════════════════════════════════════════════════

function swap() {
  const oldRun = roles.run;
  const oldMulti = roles.multi;
  roles.run = oldMulti;
  roles.multi = oldRun;
  
  console.log(`[SWAP] ⇄ RUN: Radio ${roles.run} (${getRadio(roles.run).name}) | MULTI: Radio ${roles.multi} (${getRadio(roles.multi).name})`);
  
  // If the new MULTI was transmitting, force it to RX
  const newMulti = getRadio(roles.multi);
  if (newMulti.tx) {
    console.log(`[SWAP] Forçage RX sur nouveau MULTI (Radio ${roles.multi})`);
    catWrite(roles.multi, "RX;");
  }
}

function getRadio(id) {
  return id === "A" ? radioA : radioB;
}

function getSocket(id) {
  return id === "A" ? socketA : socketB;
}

function getPort(id) {
  return id === "A" ? PORT_A : PORT_B;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAT COMMUNICATION (Kenwood protocol)
// ═══════════════════════════════════════════════════════════════════════════════

function catWrite(radioId, cmd) {
  const sock = getSocket(radioId);
  if (!sock || !sock.writable) return;
  if (VERBOSE) console.log(`[${radioId}] TX: ${cmd}`);
  sock.write(cmd);
}

function connectRadio(radioId) {
  const port = getPort(radioId);
  const radio = getRadio(radioId);
  const label = `[Radio ${radioId}]`;
  
  if (radioId === "A" && reconnectTimerA) { clearTimeout(reconnectTimerA); reconnectTimerA = null; }
  if (radioId === "B" && reconnectTimerB) { clearTimeout(reconnectTimerB); reconnectTimerB = null; }
  
  console.log(`${label} Connexion à ${CAT_HOST}:${port}...`);
  
  const sock = new net.Socket();
  sock.setKeepAlive(true, 5000);
  
  sock.connect(port, CAT_HOST, () => {
    console.log(`${label} ✅ Connecté à ${CAT_HOST}:${port} (${radio.name})`);
    radio.connected = true;
    
    if (radioId === "A") { socketA = sock; bufferA = ""; }
    else { socketB = sock; bufferB = ""; }
    
    // Initial state query (staggered)
    setTimeout(() => catWrite(radioId, "IF;"), 200);
    setTimeout(() => catWrite(radioId, "PC;"), 600);
    setTimeout(() => catWrite(radioId, "NB;"), 1000);
    
    // Start polling
    startPolling(radioId);
  });
  
  sock.on("data", (data) => {
    const str = data.toString();
    if (radioId === "A") bufferA += str; else bufferB += str;
    
    // Process complete messages (terminated by ;)
    let buffer = radioId === "A" ? bufferA : bufferB;
    const parts = buffer.split(";");
    
    // Last element is incomplete (no trailing ;)
    if (radioId === "A") bufferA = parts.pop() || "";
    else bufferB = parts.pop() || "";
    
    for (const msg of parts) {
      const trimmed = msg.trim();
      if (!trimmed) continue;
      if (VERBOSE) console.log(`[${radioId}] RX: ${trimmed};`);
      handleResponse(radioId, trimmed);
    }
  });
  
  sock.on("error", (err) => {
    console.log(`${label} Erreur: ${err.message}`);
    radio.connected = false;
  });
  
  sock.on("close", () => {
    console.log(`${label} Déconnecté`);
    radio.connected = false;
    stopPolling(radioId);
    scheduleReconnect(radioId);
  });
  
  sock.on("timeout", () => {
    console.log(`${label} Timeout — reconnexion`);
    sock.destroy();
  });
}

function scheduleReconnect(radioId) {
  const timer = setTimeout(() => connectRadio(radioId), 5000);
  if (radioId === "A") reconnectTimerA = timer;
  else reconnectTimerB = timer;
  console.log(`[Radio ${radioId}] Reconnexion dans 5s...`);
}

function startPolling(radioId) {
  stopPolling(radioId);
  let cycle = 0;
  const timer = setInterval(() => {
    const sock = getSocket(radioId);
    if (!sock || !sock.writable) return;
    switch (cycle % 4) {
      case 0: catWrite(radioId, "IF;"); break;
      case 1: catWrite(radioId, "PC;"); break;
      case 2: catWrite(radioId, "IF;"); break;
      case 3: catWrite(radioId, "NB;"); break;
    }
    cycle++;
  }, POLL_INTERVAL);
  
  if (radioId === "A") pollTimerA = timer;
  else pollTimerB = timer;
}

function stopPolling(radioId) {
  if (radioId === "A" && pollTimerA) { clearInterval(pollTimerA); pollTimerA = null; }
  if (radioId === "B" && pollTimerB) { clearInterval(pollTimerB); pollTimerB = null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function handleResponse(radioId, msg) {
  const radio = getRadio(radioId);
  
  // Ignore ?; (unsupported commands)
  if (msg === "?" || msg === "?") return;
  
  // IF — Full information
  if (msg.startsWith("IF") && msg.length > 30) {
    const hzStr = msg.slice(2, 13);
    const hz = parseInt(hzStr, 10);
    if (!isNaN(hz) && hz > 0) {
      radio.freq = hz / 1000000;
    }
    // TX status at position 28
    if (msg.length > 28) {
      const wasTx = radio.tx;
      radio.tx = msg.charAt(28) === "1";
      
      // Interlock check on TX transition
      if (!wasTx && radio.tx) {
        if (!checkInterlock(radioId, true)) {
          radio.tx = false;
        }
      }
    }
    // Mode at position 29
    if (msg.length > 29) {
      const modeCode = msg.charAt(29);
      const modes = { "1": "LSB", "2": "USB", "3": "CW", "4": "FM", "5": "AM", "7": "CW-R", "9": "FSK" };
      radio.mode = modes[modeCode] || radio.mode;
    }
  }
  // PC — Power
  else if (msg.startsWith("PC") && msg.length >= 4) {
    const val = parseInt(msg.slice(2), 10);
    if (!isNaN(val)) radio.rfPower = val;
  }
  // NB — Noise Blanker
  else if (msg.startsWith("NB") && msg.length >= 3 && msg !== "NB") {
    radio.nbEnabled = msg.charAt(2) === "1";
  }
  // NR — Noise Reduction
  else if (msg.startsWith("NR") && msg.length >= 3 && msg !== "NR") {
    radio.nrEnabled = msg.charAt(2) === "1";
  }
  // NT — ANF (Notch)
  else if (msg.startsWith("NT") && msg.length >= 3 && msg !== "NT") {
    radio.anfEnabled = msg.charAt(2) === "1";
  }
  // SH — Filter high cut (index → Hz)
  else if (msg.startsWith("SH") && msg.length >= 4 && msg !== "SH") {
    const idx = parseInt(msg.slice(2), 10);
    if (!isNaN(idx)) {
      const shTable = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000];
      radio.filterHi = idx < shTable.length ? shTable[idx] : idx * 200 + 600;
    }
  }
  // SL — Filter low cut (index → Hz)
  else if (msg.startsWith("SL") && msg.length >= 4 && msg !== "SL") {
    const idx = parseInt(msg.slice(2), 10);
    if (!isNaN(idx)) {
      radio.filterLo = idx * 50;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH TO SERVER
// ═══════════════════════════════════════════════════════════════════════════════

let pushTimer = null;

async function pushToServer() {
  const payload = {
    token: TOKEN,
    so2r: true,
    roles,
    radioA: {
      connected: radioA.connected,
      freq: radioA.freq,
      mode: radioA.mode,
      name: radioA.name,
      tx: radioA.tx,
      rfPower: radioA.rfPower,
      nbEnabled: radioA.nbEnabled,
      nrEnabled: radioA.nrEnabled,
      anfEnabled: radioA.anfEnabled,
      filterLo: radioA.filterLo,
      filterHi: radioA.filterHi,
    },
    radioB: {
      connected: radioB.connected,
      freq: radioB.freq,
      mode: radioB.mode,
      name: radioB.name,
      tx: radioB.tx,
      rfPower: radioB.rfPower,
      nbEnabled: radioB.nbEnabled,
      nrEnabled: radioB.nrEnabled,
      anfEnabled: radioB.anfEnabled,
      filterLo: radioB.filterLo,
      filterHi: radioB.filterHi,
    },
    // Also push as legacy single-radio state (RUN radio) for backward compat
    connected: getRadio(roles.run).connected,
    freq: getRadio(roles.run).freq,
    mode: getRadio(roles.run).mode,
    radio: `SO2R (RUN: ${getRadio(roles.run).name})`,
    version: "SO2R v1.0",
    rfPower: getRadio(roles.run).rfPower,
    nbEnabled: getRadio(roles.run).nbEnabled,
    nrEnabled: getRadio(roles.run).nrEnabled,
    anfEnabled: getRadio(roles.run).anfEnabled,
    filterLo: getRadio(roles.run).filterLo,
    filterHi: getRadio(roles.run).filterHi,
  };

  try {
    const url = `${SERVER_URL}/api/trpc/cat.push`;
    const resp = await fetch(url, {
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
    // Silent — will retry next cycle
    if (VERBOSE) console.log(`[PUSH] Erreur: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLING (from server/UI)
// ═══════════════════════════════════════════════════════════════════════════════

function handleServerCommand(cmd) {
  const { action } = cmd;
  
  switch (action) {
    case "swap":
      swap();
      break;
      
    case "qsy": {
      // QSY goes to the target radio (default: MULTI)
      const target = cmd.target || roles.multi;
      const freq = cmd.freq;
      if (!freq) break;
      
      const hz = Math.round(freq * 1000000);
      const hzStr = hz.toString().padStart(11, "0");
      catWrite(target, `FA${hzStr};`);
      console.log(`[QSY] Radio ${target} (${target === roles.run ? "RUN" : "MULTI"}) → ${freq.toFixed(3)} MHz`);
      
      // Set mode if provided
      if (cmd.mode) {
        const modeMap = { "LSB": "MD1;", "USB": "MD2;", "CW": "MD3;", "FM": "MD4;", "AM": "MD5;", "CW-R": "MD7;", "FSK": "MD9;" };
        const modeCmd = modeMap[cmd.mode.toUpperCase()];
        if (modeCmd) setTimeout(() => catWrite(target, modeCmd), 100);
      }
      break;
    }
    
    case "qsy_multi": {
      // Force QSY to MULTI radio
      const freq = cmd.freq;
      if (!freq) break;
      const hz = Math.round(freq * 1000000);
      const hzStr = hz.toString().padStart(11, "0");
      catWrite(roles.multi, `FA${hzStr};`);
      console.log(`[QSY MULTI] Radio ${roles.multi} → ${freq.toFixed(3)} MHz`);
      if (cmd.mode) {
        const modeMap = { "LSB": "MD1;", "USB": "MD2;", "CW": "MD3;", "FM": "MD4;", "AM": "MD5;", "CW-R": "MD7;", "FSK": "MD9;" };
        const modeCmd = modeMap[cmd.mode.toUpperCase()];
        if (modeCmd) setTimeout(() => catWrite(roles.multi, modeCmd), 100);
      }
      break;
    }
    
    case "qsy_run": {
      // Force QSY to RUN radio (rare, for manual override)
      const freq = cmd.freq;
      if (!freq) break;
      const hz = Math.round(freq * 1000000);
      const hzStr = hz.toString().padStart(11, "0");
      catWrite(roles.run, `FA${hzStr};`);
      console.log(`[QSY RUN] Radio ${roles.run} → ${freq.toFixed(3)} MHz`);
      break;
    }
    
    case "swap_and_qsy": {
      // Double-click: QSY MULTI then SWAP (so you can call immediately)
      const freq = cmd.freq;
      if (!freq) break;
      const hz = Math.round(freq * 1000000);
      const hzStr = hz.toString().padStart(11, "0");
      catWrite(roles.multi, `FA${hzStr};`);
      if (cmd.mode) {
        const modeMap = { "LSB": "MD1;", "USB": "MD2;", "CW": "MD3;", "FM": "MD4;", "AM": "MD5;", "CW-R": "MD7;", "FSK": "MD9;" };
        const modeCmd = modeMap[cmd.mode.toUpperCase()];
        if (modeCmd) setTimeout(() => catWrite(roles.multi, modeCmd), 100);
      }
      // SWAP after QSY settles
      setTimeout(() => {
        swap();
        console.log(`[SWAP+QSY] Radio ${roles.run} est maintenant RUN sur ${freq.toFixed(3)} MHz`);
      }, 300);
      break;
    }
    
    case "setpower": {
      const target = cmd.target || roles.run;
      const val = cmd.value;
      if (val !== undefined) {
        catWrite(target, `PC${val.toString().padStart(3, "0")};`);
      }
      break;
    }
    
    case "tune": {
      // TUNE only on RUN radio
      const target = roles.run;
      catWrite(target, "AC111;");
      console.log(`[TUNE] Radio ${target} (RUN)`);
      break;
    }
    
    case "mox": {
      // MOX only on RUN radio
      const target = roles.run;
      const enabled = cmd.enabled;
      catWrite(target, enabled ? "TX;" : "RX;");
      console.log(`[MOX] Radio ${target} (RUN) → ${enabled ? "TX" : "RX"}`);
      break;
    }
    
    case "dsp": {
      const target = cmd.target || roles.run;
      const param = cmd.param;
      const enabled = cmd.enabled;
      if (param === "nb") catWrite(target, `NB${enabled ? "1" : "0"};`);
      else if (param === "nr") catWrite(target, `NR${enabled ? "1" : "0"};`);
      else if (param === "anf") catWrite(target, `NT${enabled ? "1" : "0"};`);
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
console.log("║  DX HUNTER — Bridge SO2R v1.0 (Dual FlexRadio)             ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  Radio A : ${NAME_A} → ${CAT_HOST}:${PORT_A}`.padEnd(64) + "║");
console.log(`║  Radio B : ${NAME_B} → ${CAT_HOST}:${PORT_B}`.padEnd(64) + "║");
console.log(`║  RUN     : Radio ${roles.run} (${getRadio(roles.run).name})`.padEnd(64) + "║");
console.log(`║  MULTI   : Radio ${roles.multi} (${getRadio(roles.multi).name})`.padEnd(64) + "║");
console.log(`║  Serveur : ${SERVER_URL}`.padEnd(64) + "║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Interlock TX : ACTIF (un seul poste émet à la fois)       ║");
console.log("║  SWAP         : via commande serveur ou pédale             ║");
console.log("║  QSY cluster  : → MULTI automatiquement                    ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");

// Connect both radios
connectRadio("A");
setTimeout(() => connectRadio("B"), 1000); // Stagger connections

// Start push loop
pushTimer = setInterval(pushToServer, PUSH_INTERVAL);

// Status display every 10s
setInterval(() => {
  const runRadio = getRadio(roles.run);
  const multiRadio = getRadio(roles.multi);
  const runStatus = runRadio.connected ? `${runRadio.freq.toFixed(3)} MHz ${runRadio.mode}${runRadio.tx ? " 📡TX" : ""}` : "déconnecté";
  const multiStatus = multiRadio.connected ? `${multiRadio.freq.toFixed(3)} MHz ${multiRadio.mode}` : "déconnecté";
  console.log(`[SO2R] 🟢 RUN (${roles.run}): ${runStatus}  |  🔵 MULTI (${roles.multi}): ${multiStatus}`);
}, 10000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bridge] Arrêt SO2R...");
  if (pollTimerA) clearInterval(pollTimerA);
  if (pollTimerB) clearInterval(pollTimerB);
  if (pushTimer) clearInterval(pushTimer);
  if (socketA) socketA.destroy();
  if (socketB) socketB.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => process.emit("SIGINT"));
