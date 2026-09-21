/**
 * DX HUNTER — CAT Bridge Relay v8.0 (FlexRadio Native API — port 4992)
 *
 * Architecture :
 * - Connexion TCP directe au FlexRadio sur port 4992 (API native SmartSDR)
 * - Pas besoin de SmartSDR Mac/Win pour le contrôle (connexion directe au radio)
 * - SmartSDR DOIT tourner pour les spots sur le panadapter (client GUI requis)
 * - Reads: slice freq/mode, NB/NR/ANF/APF, RF gain, filter, power, EQ
 * - Executes: QSY, split, power, tune, mox, DSP, filter, EQ, antenna, spots
 * - Telemetry: S-meter, forward power, SWR, ALC, PA temp (via meter subscription)
 * - TCP connection to Antenna Genius (port 9007, GSCP protocol) for antenna switching
 * - Pushes state to DX Hunter server via HTTP POST (tRPC relay)
 * - Receives commands from server in the POST response
 *
 * PAS de npm install requis. Node.js 18+ (fetch natif + net).
 *
 * Usage :
 *   node bridge-relay-v8.mjs
 *
 * Configuration (variables d'environnement) :
 *   SERVER_URL      — URL du serveur DX Hunter (défaut: https://dxclusterf4ivv.manus.space)
 *   TOKEN           — Token d'authentification (OBLIGATOIRE, 24 caractères minimum)
 *   FLEX_IP         — IP du FlexRadio (défaut: 192.168.1.100)
 *   FLEX_PORT       — Port API native (défaut: 4992)
 *   SLICE_ID        — Slice à contrôler (défaut: 0)
 *   AG_HOST         — IP de l'Antenna Genius (défaut: 127.0.0.1)
 *   AG_PORT         — Port Antenna Genius GSCP (défaut: 9007)
 *   AG_ENABLED      — Activer Antenna Genius (défaut: false)
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
const FLEX_IP = process.env.FLEX_IP || "192.168.1.100";
const FLEX_PORT = parseInt(process.env.FLEX_PORT || "4992");
const SLICE_ID = parseInt(process.env.SLICE_ID || "0");
const AG_HOST = process.env.AG_HOST || "127.0.0.1";
const AG_PORT = parseInt(process.env.AG_PORT || "9007");
const AG_ENABLED = (process.env.AG_ENABLED || "false") === "true";

const PUSH_INTERVAL_MS = 800;
const PING_INTERVAL_MS = 4000;
const RECONNECT_DELAY_MS = 5000;
const CAT_PUSH_URL = SERVER_URL + "/api/trpc/cat.push";
const ANT_PUSH_URL = SERVER_URL + "/api/trpc/antenna.push";

// ═══════════════════════════════════════════════════════════════════════════════
// FLEX RADIO STATE
// ═══════════════════════════════════════════════════════════════════════════════
let radioConnected = false;
let flexSocket = null;
let rxBuffer = "";
let seq = 1;
let pending = new Map(); // seq → { resolve, reject, timer }
let clientHandle = null;
let radioVersion = null;
let guiClientHandle = null; // Handle of SmartSDR GUI client (for spot binding)
let pingTimer = null;

// Slice state
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
let smeter = -127;         // dBm
let fwdPower = 0;          // Watts
let swr = 1.0;
let alc = 0;              // %
let paTemp = 0;           // °C

// Meter IDs (discovered at runtime)
let meterIds = {};         // name → id

// Spot tracking
let activeSpots = new Map(); // callsign+freq → spot_index

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
// FLEX RADIO CONNECTION — Native API (port 4992)
// ═══════════════════════════════════════════════════════════════════════════════
function connectFlex() {
  if (flexSocket) {
    try { flexSocket.destroy(); } catch {}
    flexSocket = null;
  }
  radioConnected = false;
  clientHandle = null;
  guiClientHandle = null;

  console.log(`[Flex] Connexion à ${FLEX_IP}:${FLEX_PORT}...`);
  flexSocket = net.createConnection(FLEX_PORT, FLEX_IP, () => {
    console.log(`[Flex] TCP connecté à ${FLEX_IP}:${FLEX_PORT}`);
  });
  flexSocket.setEncoding("utf8");
  flexSocket.setKeepAlive(true, 10000);

  flexSocket.on("data", (data) => {
    rxBuffer += data;
    const lines = rxBuffer.split("\n");
    rxBuffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      handleFlexLine(t);
    }
  });

  flexSocket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log(`[Flex] Port ${FLEX_PORT} refusé — FlexRadio allumé ? IP correcte ?`);
    } else {
      console.error("[Flex] Erreur:", err.message);
    }
  });

  flexSocket.on("close", () => {
    if (radioConnected) console.log("[Flex] Déconnecté");
    radioConnected = false;
    flexSocket = null;
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    console.log(`[Flex] Reconnexion dans ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connectFlex, RECONNECT_DELAY_MS);
  });
}

function handleFlexLine(line) {
  const ch = line[0];
  if (ch === "V") {
    // Version
    radioVersion = line.slice(1);
    console.log(`[Flex] Version API: ${radioVersion}`);
  } else if (ch === "H") {
    // Handle — connection established
    clientHandle = line.slice(1);
    console.log(`[Flex] Handle client: ${clientHandle}`);
    radioConnected = true;
    initFlexSession();
  } else if (ch === "R") {
    // Response
    handleResponse(line);
  } else if (ch === "S") {
    // Status
    handleStatus(line);
  } else if (ch === "M") {
    // Message from radio
    const msg = line.slice(line.indexOf("|") + 1);
    if (msg) console.log(`[Flex] Message: ${msg}`);
  }
}

async function initFlexSession() {
  try {
    // Identify ourselves
    await flexSend("client program DXHunter");
    // Subscribe to all slice status updates
    await flexSend("sub slice all");
    // Subscribe to transmit status
    await flexSend("sub tx all");
    // Subscribe to interlock status (for MOX/TX state)
    await flexSend("sub radio all");
    // Subscribe to spots
    await flexSend("sub spot all");
    // Get slice list
    await flexSend("slice list");
    // Get meter list for telemetry
    const meterResp = await flexSend("meter list");
    parseMeterList(meterResp);
    // Subscribe to key meters
    subscribeMeters();
    // Start keepalive ping
    startPing();
    console.log("[Flex] Session initialisée — prêt");
  } catch (err) {
    console.error("[Flex] Erreur init:", err.message);
  }
}

function flexSend(cmd, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (!flexSocket || !flexSocket.writable) {
      reject(new Error("Not connected"));
      return;
    }
    const s = seq++;
    const timer = setTimeout(() => {
      pending.delete(s);
      reject(new Error(`Timeout: ${cmd}`));
    }, timeout);
    pending.set(s, { resolve, reject, timer });
    flexSocket.write(`C${s}|${cmd}\n`);
  });
}

function flexSendFire(cmd) {
  // Fire and forget — no response tracking
  if (!flexSocket || !flexSocket.writable) return;
  const s = seq++;
  flexSocket.write(`C${s}|${cmd}\n`);
}

function handleResponse(line) {
  // R<seq>|<hex_response>|<message>
  const parts = line.slice(1).split("|");
  const respSeq = parseInt(parts[0]);
  const hexCode = parts[1] || "0";
  const message = parts.slice(2).join("|");
  const p = pending.get(respSeq);
  if (p) {
    clearTimeout(p.timer);
    pending.delete(respSeq);
    if (hexCode === "0" || hexCode === "00000000") {
      p.resolve(message);
    } else {
      p.reject(new Error(`Flex 0x${hexCode}: ${message}`));
    }
  }
}

function handleStatus(line) {
  // S<handle>|<message>
  const pipeIdx = line.indexOf("|");
  if (pipeIdx < 0) return;
  const statusHandle = line.slice(1, pipeIdx);
  const msg = line.slice(pipeIdx + 1);

  // Parse slice status
  const sliceMatch = msg.match(/^slice (\d+) (.+)/);
  if (sliceMatch) {
    const id = parseInt(sliceMatch[1]);
    if (id === SLICE_ID) {
      parseSliceStatus(sliceMatch[2]);
    }
    return;
  }

  // Parse transmit status
  if (msg.startsWith("transmit ")) {
    parseTransmitStatus(msg.slice(9));
    return;
  }

  // Parse interlock status
  if (msg.startsWith("interlock ")) {
    parseInterlockStatus(msg.slice(10));
    return;
  }

  // Parse client status (to find GUI client handle for spots)
  if (msg.startsWith("client ")) {
    parseClientStatus(msg.slice(7), statusHandle);
    return;
  }

  // Parse meter data (TCP-based)
  if (msg.startsWith("meter ")) {
    parseMeterStatus(msg.slice(6));
    return;
  }

  // Parse spot status
  if (msg.startsWith("spot ")) {
    parseSpotStatus(msg.slice(5));
    return;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE STATUS PARSING
// ═══════════════════════════════════════════════════════════════════════════════
function parseSliceStatus(data) {
  const kv = parseKeyValues(data);

  if (kv.RF_frequency !== undefined) {
    const f = parseFloat(kv.RF_frequency);
    if (!isNaN(f) && f > 0) currentFreq = f;
  }
  if (kv.mode !== undefined) currentMode = kv.mode.toUpperCase();
  if (kv.nb !== undefined) nbEnabled = kv.nb === "1";
  if (kv.nr !== undefined) nrEnabled = kv.nr === "1";
  if (kv.anf !== undefined) anfEnabled = kv.anf === "1";
  if (kv.apf !== undefined) apfEnabled = kv.apf === "1";
  if (kv.rf_gain !== undefined) rfGain = parseInt(kv.rf_gain) || 0;
  if (kv.txant !== undefined) txAnt = kv.txant;
  if (kv.rxant !== undefined) rxAnt = kv.rxant;
  if (kv.filter_lo !== undefined) filterLo = Math.abs(parseInt(kv.filter_lo) || 100);
  if (kv.filter_hi !== undefined) filterHi = Math.abs(parseInt(kv.filter_hi) || 2800);
}

function parseTransmitStatus(data) {
  const kv = parseKeyValues(data);
  if (kv.rfpower !== undefined) rfPower = parseInt(kv.rfpower) || 100;
  if (kv.tunepower !== undefined) { /* store if needed */ }
  if (kv.tune !== undefined) tuneActive = kv.tune === "1";
}

function parseInterlockStatus(data) {
  const kv = parseKeyValues(data);
  if (kv.state !== undefined) {
    moxActive = kv.state === "TRANSMITTING";
    if (kv.state === "READY" || kv.state === "RECEIVE") {
      moxActive = false;
      tuneActive = false;
    }
  }
}

function parseClientStatus(data, handle) {
  // Detect GUI clients for spot binding
  const kv = parseKeyValues(data);
  if (kv.gui !== undefined && handle !== "0") {
    if (!guiClientHandle) {
      guiClientHandle = handle;
      console.log(`[Flex] GUI client détecté: handle ${handle}`);
    }
  }
}

function parseMeterStatus(data) {
  // meter <id> <key>=<value> ...
  // or: <id>.<name>=<value>
  const kv = parseKeyValues(data);
  // The meter status format varies; handle common patterns
  for (const [key, val] of Object.entries(kv)) {
    const numVal = parseFloat(val);
    if (isNaN(numVal)) continue;
    // Map meter names to telemetry
    if (key.includes("signal") || key === "lvl") {
      smeter = numVal; // dBm
    } else if (key.includes("fwdpwr") || key === "fwd") {
      fwdPower = numVal;
    } else if (key.includes("swr")) {
      swr = numVal;
    } else if (key.includes("alc")) {
      alc = numVal;
    } else if (key.includes("patemp") || key.includes("temp")) {
      paTemp = numVal;
    }
  }
}

function parseSpotStatus(data) {
  // spot <index> triggered pan=0x... → spot was clicked
  if (data.includes("triggered")) {
    const m = data.match(/^(\d+) triggered/);
    if (m) {
      console.log(`[Flex] Spot ${m[1]} cliqué sur le panadapter`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// METER HANDLING
// ═══════════════════════════════════════════════════════════════════════════════
function parseMeterList(response) {
  // Response format varies; try to extract meter IDs
  // Typical: "1 src=SLC num=0 nam=LEVEL ..."
  if (!response) return;
  const lines = response.split("\n").filter(Boolean);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const id = parseInt(parts[0]);
    if (isNaN(id)) continue;
    const kv = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf("=");
      if (eq > 0) kv[p.slice(0, eq)] = p.slice(eq + 1);
    }
    if (kv.nam) {
      meterIds[kv.nam.toLowerCase()] = id;
    }
  }
  console.log(`[Flex] ${Object.keys(meterIds).length} meters découverts`);
}

function subscribeMeters() {
  // Subscribe to key meters by name
  const wanted = ["lvl", "signal", "fwdpwr", "swr", "alc", "patemp"];
  for (const name of wanted) {
    const id = meterIds[name];
    if (id !== undefined) {
      flexSendFire(`sub meter ${id}`);
    }
  }
  // Also try common meter IDs if names not found
  // Flex typically has meters 1-30 for various readings
  if (Object.keys(meterIds).length === 0) {
    // Fallback: subscribe to first 20 meters
    for (let i = 1; i <= 20; i++) {
      flexSendFire(`sub meter ${i}`);
    }
  }
}

function startPing() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (flexSocket && flexSocket.writable) {
      flexSendFire("ping");
    }
  }, PING_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Parse key=value pairs from Flex status messages
// ═══════════════════════════════════════════════════════════════════════════════
function parseKeyValues(str) {
  const result = {};
  const re = /(\w+)=([^\s]+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND EXECUTION — Native Flex API
// ═══════════════════════════════════════════════════════════════════════════════
async function executeCommand(cmd) {
  if (!radioConnected) {
    console.log(`[Flex] Commande ignorée (non connecté): ${cmd.action}`);
    return;
  }
  try {
    switch (cmd.action) {
      case "qsy": {
        if (cmd.freq) {
          const freqMHz = cmd.freq;
          console.log(`[Flex] QSY → ${freqMHz.toFixed(3)} MHz`);
          await flexSend(`slice t ${SLICE_ID} ${freqMHz.toFixed(6)}`);
          if (cmd.mode) {
            const flexMode = mapMode(cmd.mode, freqMHz);
            await flexSend(`slice s ${SLICE_ID} mode=${flexMode}`);
          }
          currentFreq = freqMHz;
        }
        break;
      }

      case "split": {
        if (cmd.rxFreq && cmd.txFreq) {
          console.log(`[Flex] SPLIT → RX ${cmd.rxFreq.toFixed(3)} / TX ${cmd.txFreq.toFixed(3)} MHz`);
          await flexSend(`slice t ${SLICE_ID} ${cmd.rxFreq.toFixed(6)}`);
          if (cmd.mode) {
            const flexMode = mapMode(cmd.mode, cmd.rxFreq);
            await flexSend(`slice s ${SLICE_ID} mode=${flexMode}`);
          }
          const offsetHz = Math.round((cmd.txFreq - cmd.rxFreq) * 1e6);
          await flexSend(`slice s ${SLICE_ID} xit_on=1 xit_freq=${offsetHz}`);
          currentFreq = cmd.rxFreq;
        }
        break;
      }

      case "setpower": {
        if (cmd.value !== undefined) {
          const pw = Math.max(0, Math.min(100, Math.round(cmd.value)));
          console.log(`[Flex] RF Power → ${pw}W`);
          await flexSend(`transmit set rfpower=${pw}`);
          rfPower = pw;
        }
        break;
      }

      case "tune": {
        if (cmd.enabled) {
          console.log("[Flex] TUNE ON");
          await flexSend("transmit tune on");
          tuneActive = true;
        } else {
          console.log("[Flex] TUNE OFF");
          await flexSend("transmit tune off");
          tuneActive = false;
        }
        break;
      }

      case "mox": {
        if (cmd.enabled) {
          console.log("[Flex] MOX ON (TX)");
          await flexSend("xmit 1");
          moxActive = true;
        } else {
          console.log("[Flex] MOX OFF (RX)");
          await flexSend("xmit 0");
          moxActive = false;
        }
        break;
      }

      case "dsp": {
        if (cmd.param && cmd.enabled !== undefined) {
          const val = cmd.enabled ? "1" : "0";
          console.log(`[Flex] DSP ${cmd.param} → ${cmd.enabled ? "ON" : "OFF"}`);
          switch (cmd.param) {
            case "nb":
              await flexSend(`slice s ${SLICE_ID} nb=${val}`);
              nbEnabled = cmd.enabled;
              break;
            case "nr":
              await flexSend(`slice s ${SLICE_ID} nr=${val}`);
              nrEnabled = cmd.enabled;
              break;
            case "anf":
              await flexSend(`slice s ${SLICE_ID} anf=${val}`);
              anfEnabled = cmd.enabled;
              break;
          }
        }
        break;
      }

      case "apf": {
        if (cmd.enabled !== undefined) {
          const val = cmd.enabled ? "1" : "0";
          console.log(`[Flex] APF → ${cmd.enabled ? "ON" : "OFF"}`);
          await flexSend(`slice s ${SLICE_ID} apf=${val}`);
          apfEnabled = cmd.enabled;
        }
        break;
      }

      case "setfilter": {
        if (cmd.filterLo !== undefined && cmd.filterHi !== undefined) {
          console.log(`[Flex] Filtre → ${cmd.filterLo}-${cmd.filterHi} Hz`);
          await flexSend(`filt ${SLICE_ID} ${cmd.filterLo} ${cmd.filterHi}`);
          filterLo = cmd.filterLo;
          filterHi = cmd.filterHi;
        }
        break;
      }

      case "setrfgain": {
        if (cmd.rfGain !== undefined) {
          console.log(`[Flex] RF Gain → ${cmd.rfGain} dB`);
          await flexSend(`slice s ${SLICE_ID} rf_gain=${cmd.rfGain}`);
          rfGain = cmd.rfGain;
        }
        break;
      }

      case "seteq": {
        if (cmd.eqBands && cmd.eqBands.length === 8) {
          console.log(`[Flex] EQ RX → [${cmd.eqBands.join(",")}]`);
          // Flex EQ: eq rxsc <band_index> level=<-12 to +12>
          // Bands: 0=63Hz, 1=125Hz, 2=250Hz, 3=500Hz, 4=1kHz, 5=2kHz, 6=4kHz, 7=8kHz
          for (let i = 0; i < 8; i++) {
            flexSendFire(`eq rxsc ${i} level=${cmd.eqBands[i]}`);
          }
          eqBands = cmd.eqBands;
          if (cmd.enabled !== undefined) eqEnabled = cmd.enabled;
        }
        break;
      }

      case "setpreset": {
        if (cmd.preset) {
          console.log(`[Flex] Preset RX → ${cmd.preset}`);
          rxPreset = cmd.preset;
          // Apply filter if provided with preset
          if (cmd.filterLo !== undefined && cmd.filterHi !== undefined) {
            await flexSend(`filt ${SLICE_ID} ${cmd.filterLo} ${cmd.filterHi}`);
            filterLo = cmd.filterLo;
            filterHi = cmd.filterHi;
          }
        }
        break;
      }

      case "setant": {
        if (cmd.ant && cmd.type) {
          console.log(`[Flex] Antenne ${cmd.type} → ${cmd.ant}`);
          if (cmd.type === "txant") {
            await flexSend(`slice s ${SLICE_ID} txant=${cmd.ant}`);
            txAnt = cmd.ant;
          } else if (cmd.type === "rxant") {
            await flexSend(`slice s ${SLICE_ID} rxant=${cmd.ant}`);
            rxAnt = cmd.ant;
          }
        }
        break;
      }

      case "spot": {
        if (cmd.freq && cmd.callsign) {
          const freqMHz = cmd.freq;
          const call = cmd.callsign;
          const color = cmd.color || "";
          const comment = "";
          const timestamp = Math.floor(Date.now() / 1000);
          // Encode spaces as 0x7F per Flex API
          const safeCall = call.replace(/ /g, "\x7F");
          const spotCmd = `spot add rx_freq=${freqMHz.toFixed(6)} callsign=${safeCall} mode=${currentMode || "USB"} color=${color} source=DXHunter spotter_callsign=F4IVV timestamp=${timestamp} lifetime_seconds=1800 priority=3 trigger_action=tune`;
          console.log(`[Flex] Spot → ${call} @ ${freqMHz.toFixed(3)} MHz`);
          try {
            const resp = await flexSend(spotCmd);
            // Response contains spot index
            const spotIdx = parseInt(resp);
            if (!isNaN(spotIdx)) {
              activeSpots.set(`${call}@${freqMHz.toFixed(3)}`, spotIdx);
            }
          } catch (err) {
            console.log(`[Flex] Spot erreur: ${err.message}`);
          }
        }
        break;
      }

      case "clearspots": {
        console.log(`[Flex] Clear ${activeSpots.size} spots`);
        for (const [key, idx] of activeSpots) {
          flexSendFire(`spot remove ${idx}`);
        }
        activeSpots.clear();
        break;
      }

      default:
        console.log(`[Flex] Commande inconnue: ${cmd.action}`);
    }
  } catch (err) {
    console.error(`[Flex] Erreur commande ${cmd.action}:`, err.message);
  }
}

function mapMode(mode, freqMHz) {
  const m = (mode || "").toUpperCase();
  if (m === "SSB" || m === "PHONE") return freqMHz < 10 ? "LSB" : "USB";
  if (m === "LSB" || m === "USB" || m === "CW" || m === "AM" || m === "FM") return m;
  if (m === "DIGU" || m === "FT8" || m === "FT4" || m === "DIGITAL") return "DIGU";
  if (m === "DIGL") return "DIGL";
  if (m === "RTTY") return "RTTY";
  if (m === "CW-R") return "CW";
  return freqMHz < 10 ? "LSB" : "USB";
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
    agSend("STATUS");
    agSend("PORTCOUNT");
    agSend("PORTNAMES");
  });
  agSocket.setEncoding("utf8");
  agSocket.setKeepAlive(true, 10000);

  agSocket.on("data", (data) => {
    agBuffer += data;
    let idx;
    while ((idx = agBuffer.indexOf("\n")) !== -1) {
      const line = agBuffer.slice(0, idx).trim();
      agBuffer = agBuffer.slice(idx + 1);
      if (line) handleAgResponse(line);
    }
  });

  agSocket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log(`[AG] Port ${AG_PORT} refusé — Antenna Genius actif ?`);
    }
  });

  agSocket.on("close", () => {
    if (agConnected) console.log("[AG] Déconnecté");
    agConnected = false;
    agSocket = null;
    if (AG_ENABLED) {
      console.log(`[AG] Reconnexion dans ${RECONNECT_DELAY_MS / 1000}s...`);
      setTimeout(connectAntennaGenius, RECONNECT_DELAY_MS);
    }
  });
}

function agSend(cmd) {
  if (agSocket && agSocket.writable) {
    agSocket.write(cmd + "\r\n");
  }
}

function handleAgResponse(line) {
  if (line.startsWith("PORT ")) {
    const num = parseInt(line.slice(5));
    if (!isNaN(num)) agSelectedPort = num;
  } else if (line.startsWith("PORTCOUNT ")) {
    const n = parseInt(line.slice(10));
    if (!isNaN(n)) agPortCount = n;
  } else if (line.startsWith("PORTNAMES ")) {
    const names = line.slice(10).split(",").map(s => s.trim());
    if (names.length > 0) agPortNames = names;
  }
}

function executeAgCommand(cmd) {
  if (!agConnected) return;
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
        radio: `FlexRadio @ ${FLEX_IP}`,
        version: "Native API v8.0",
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
    if (res.ok) {
      const respJson = await res.json();
      const data = respJson?.result?.data?.json;
      if (data && data.commands && data.commands.length > 0) {
        for (const cmd of data.commands) {
          executeCommand(cmd);
        }
      }
    }
  } catch (err) {
    // Silent retry next cycle
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
console.log("║  DX HUNTER — Bridge Relay v8.0 (FlexRadio Native API)      ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  FlexRadio  : ${FLEX_IP}:${FLEX_PORT} (API native)`.padEnd(64) + "║");
console.log(`║  Slice      : ${SLICE_ID}`.padEnd(64) + "║");
if (AG_ENABLED) {
  console.log(`║  Ant Genius : ${AG_HOST}:${AG_PORT}`.padEnd(64) + "║");
} else {
  console.log("║  Ant Genius : DÉSACTIVÉ".padEnd(64) + "║");
}
console.log(`║  Serveur    : ${SERVER_URL}`.padEnd(64) + "║");
console.log(`║  Token      : ${TOKEN.substring(0, 8)}...`.padEnd(64) + "║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Fonctions (API native FlexRadio) :                        ║");
console.log("║    ✓ Fréquence, mode, QSY, Split (XIT)                     ║");
console.log("║    ✓ Power (transmit set rfpower)                           ║");
console.log("║    ✓ TUNE (transmit tune on/off)                            ║");
console.log("║    ✓ MOX (xmit 1/0)                                        ║");
console.log("║    ✓ DSP : NB, NR, ANF, APF (slice set)                    ║");
console.log("║    ✓ Filtre passe-bande (filt)                              ║");
console.log("║    ✓ RF Gain (slice set rf_gain)                            ║");
console.log("║    ✓ EQ RX 8 bandes (eq rxsc)                              ║");
console.log("║    ✓ Sélection antenne RX/TX (slice set rxant/txant)        ║");
console.log("║    ✓ Spots sur panadapter (spot add/remove)                 ║");
console.log("║    ✓ Télémétrie : S-mètre, Power, SWR, ALC, PA Temp        ║");
console.log("║    ✓ Keepalive (ping toutes les 4s)                         ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  [Info] Connexion directe au FlexRadio (pas via SmartSDR)   ║");
console.log("║  [Info] SmartSDR doit tourner pour les spots panadapter     ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");

// Start connections
connectFlex();
if (AG_ENABLED) connectAntennaGenius();

// Push state to server periodically
setInterval(pushCatState, PUSH_INTERVAL_MS);
if (AG_ENABLED) setInterval(pushAntennaState, PUSH_INTERVAL_MS * 2);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bridge] Arrêt...");
  if (flexSocket) flexSocket.destroy();
  if (agSocket) agSocket.destroy();
  process.exit(0);
});
process.on("SIGTERM", () => {
  if (flexSocket) flexSocket.destroy();
  if (agSocket) agSocket.destroy();
  process.exit(0);
});
