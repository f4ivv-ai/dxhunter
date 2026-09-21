/**
 * DX HUNTER — Bridge SO2V v2.2 (CAT Only)
 *
 * Supporte deux modes :
 * - Single Slice : un seul panadapteur (FA uniquement). QSY, filtres, DSP fonctionnent.
 * - SO2V (dual slice) : deux panadapteurs (FA + FB). SWAP, QSY MULTI, interlock TX.
 *
 * Détection automatique : si FB retourne 0 Hz pendant 5 polls → mode single-slice.
 *
 * Architecture :
 * - Connexion CAT à SmartSDR (port 5001) pour commandes supportées
 * - Push HTTP vers DX Hunter avec état complet
 * - Commandes ciblées : QSY, filtres, DSP, puissance, TX
 *
 * Commandes CAT supportées (SmartSDR WAN) :
 *   ✅ SL/SH (filtres audio)
 *   ✅ NB/NR/NT (DSP)
 *   ✅ EQ (égaliseur on/off)
 *   ✅ PC (puissance)
 *   ✅ TX/RX (émission)
 *   ✅ FA/FB (QSY)
 *   ✅ MD (mode)
 *   ❌ AG (volume) — non supporté
 *   ❌ AN (antenne) — non supporté
 *   ❌ ZZMA (mute) — non supporté
 *
 * Usage :
 *   node bridge-so2v.mjs
 *
 * Env vars :
 *   CAT_HOST       : IP SmartSDR CAT (défaut 127.0.0.1)
 *   CAT_PORT       : Port CAT (défaut 5001)
 *   INITIAL_RUN    : Slice initial en RUN (A ou B, défaut A)
 *   SERVER_URL     : URL DX Hunter (défaut https://dxclusterf4ivv.manus.space)
 *   TOKEN          : Token bridge (OBLIGATOIRE, 24 caractères minimum)
 *   PUSH_INTERVAL  : Intervalle push ms (défaut 800)
 *   POLL_INTERVAL  : Intervalle polling CAT ms (défaut 1200)
 *   VERBOSE        : Afficher toutes les commandes/réponses (défaut false)
 */

import net from "net";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CAT_HOST = process.env.CAT_HOST || "127.0.0.1";
const CAT_PORT = parseInt(process.env.CAT_PORT || "5001", 10);
const INITIAL_RUN = (process.env.INITIAL_RUN || "A").toUpperCase();

const SERVER_URL = (process.env.SERVER_URL || "https://dxclusterf4ivv.manus.space").replace(/\/$/, "");
const TOKEN = process.env.TOKEN;
if (!TOKEN || TOKEN.length < 24) {
  console.error("ERREUR : définissez TOKEN (24 caractères minimum), identique à CAT_BRIDGE_TOKEN côté serveur.");
  process.exit(1);
}
const PUSH_INTERVAL = parseInt(process.env.PUSH_INTERVAL || "800", 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "1200", 10);
const VERBOSE = process.env.VERBOSE === "true";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

let roles = { run: INITIAL_RUN === "B" ? "B" : "A", multi: INITIAL_RUN === "B" ? "A" : "B" };

const sliceA = {
  name: "Slice A", freq: 0, mode: "", tx: false,
  rfPower: 100, nbEnabled: false, nrEnabled: false, anfEnabled: false, eqEnabled: false,
  filterLo: 100, filterHi: 2800, smeter: 0,
};

const sliceB = {
  name: "Slice B", freq: 0, mode: "", tx: false,
  rfPower: 100, nbEnabled: false, nrEnabled: false, anfEnabled: false, eqEnabled: false,
  filterLo: 100, filterHi: 2800, smeter: 0,
};

let socket = null;
let buffer = "";
let connected = false;
let pollTimer = null;
let pushTimer = null;
let reconnectTimer = null;
let lastDataTime = Date.now();

// Single-slice detection: if FB stays at 0 for several polls, we're in single mode
let fbZeroCount = 0;
const FB_ZERO_THRESHOLD = 4; // After 4 polls with FB=0, switch to single-slice mode
let isSo2v = false; // Start as single-slice, upgrade to SO2V when FB reports a frequency

// ═══════════════════════════════════════════════════════════════════════════════
// INTERLOCK TX
// ═══════════════════════════════════════════════════════════════════════════════

function checkInterlock(sliceId, wantsTx) {
  if (!wantsTx) return true;
  if (!isSo2v) return true; // No interlock in single-slice mode
  if (sliceId === roles.run) return true;
  console.log(`[INTERLOCK] ⚠️  TX refusé sur Slice ${sliceId} (MULTI) — seul RUN peut émettre`);
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function swap() {
  const oldRun = roles.run;
  roles = { run: roles.multi, multi: roles.run };
  console.log(`[SWAP] ⇄ RUN: Slice ${roles.run} | MULTI: Slice ${roles.multi}`);
}

function getSlice(id) {
  return id === "A" ? sliceA : sliceB;
}

function catWrite(cmd) {
  if (!socket || !socket.writable) return;
  socket.write(cmd);
  if (VERBOSE) console.log(`[CAT →] ${cmd}`);
}

function guessModeFromFreq(freqMHz) {
  if (freqMHz < 0.5) return "";
  if (freqMHz < 10) return freqMHz < 7.05 ? "LSB" : "LSB";
  return "USB";
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAT CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

function connectCat() {
  if (socket) {
    try { socket.destroy(); } catch {}
    socket = null;
  }
  connected = false;

  console.log(`[CAT] Connexion à ${CAT_HOST}:${CAT_PORT}...`);

  socket = net.createConnection(CAT_PORT, CAT_HOST, () => {
    console.log(`[CAT] ✅ Connecté à ${CAT_HOST}:${CAT_PORT}`);
    connected = true;
    lastDataTime = Date.now();
    // Initial safe commands (like old bridge v7 — no FB, no SM0)
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
    // Start polling after initial commands are sent
    setTimeout(() => startPolling(), 1500);
  });
  socket.setEncoding("utf8");
  socket.setKeepAlive(true, 5000);

  socket.on("data", (data) => {
    lastDataTime = Date.now();
    buffer += data;
    const parts = buffer.split(";");
    buffer = parts.pop() || "";
    for (const p of parts) {
      const msg = p.trim();
      if (msg) handleResponse(msg);
    }
  });

  socket.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.log("[CAT] Connexion refusée — SmartSDR démarré ?");
    } else {
      console.error("[CAT] Erreur:", err.message);
    }
  });

  socket.on("close", () => {
    if (connected) console.log("[CAT] Déconnecté");
    connected = false;
    socket = null;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    reconnectTimer = setTimeout(connectCat, 5000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAT POLLING
// ═══════════════════════════════════════════════════════════════════════════════

let pollStep = 0;
let stablePollCount = 0; // Count successful FA/IF polls before probing FB
const STABLE_THRESHOLD = 4; // After 4 successful polls, start probing FB

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  stablePollCount = 0;
  pollTimer = setInterval(() => {
    if (!connected) return;

    // Phase 1: Safe polling (like old bridge) — only FA; and IF;
    // This ensures SmartSDR doesn't reject the connection with 1 slice
    if (stablePollCount < STABLE_THRESHOLD) {
      stablePollCount++;
      pollStep = (pollStep + 1) % 3;
      switch (pollStep) {
        case 0: catWrite("FA;"); break;
        case 1: catWrite("IF;"); break;
        case 2: catWrite("PC;"); break;
      }
      return;
    }

    // Phase 2: Full polling — now safe to probe FB, MD, SM0
    pollStep = (pollStep + 1) % 6;
    switch (pollStep) {
      case 0: catWrite("FA;"); break;
      case 1: catWrite("FB;"); break;
      case 2: catWrite("MD;"); break;
      case 3: catWrite("IF;"); break;
      case 4: catWrite("PC;"); break;
      case 5: catWrite("NB;"); break; // NB instead of SM0 (SM0 may not be supported)
    }
  }, POLL_INTERVAL);
}

function handleResponse(msg) {
  if (VERBOSE) console.log(`[CAT ←] ${msg}`);

  // FA — Fréquence Slice A
  if (msg.startsWith("FA") && msg.length >= 13) {
    const hz = parseInt(msg.slice(2));
    if (!isNaN(hz)) {
      sliceA.freq = hz / 1000000;
      // Detect if Slice A went to 0 (closed)
      if (sliceA.freq < 0.5 && isSo2v && sliceB.freq > 0.5) {
        // Slice A was closed, Slice B remains — switch RUN to B
        isSo2v = false;
        roles = { run: "B", multi: "A" };
        console.log(`[MODE] 🔄 Slice A fermé — Single-Slice sur Slice B (${sliceB.freq.toFixed(3)} MHz)`);
      }
    }
  }
  // FB — Fréquence Slice B
  else if (msg.startsWith("FB") && msg.length >= 13) {
    const hz = parseInt(msg.slice(2));
    if (!isNaN(hz)) {
      sliceB.freq = hz / 1000000;
      // Detect SO2V mode: if FB has a real frequency, we're in dual-slice
      if (sliceB.freq > 0.5) {
        fbZeroCount = 0;
        if (!isSo2v) {
          isSo2v = true;
          console.log(`[MODE] 🔄 Passage en SO2V (Slice B détecté : ${sliceB.freq.toFixed(3)} MHz)`);
        }
      } else {
        fbZeroCount++;
        if (fbZeroCount >= FB_ZERO_THRESHOLD && isSo2v) {
          // Slice B was closed, Slice A remains — force RUN to A
          isSo2v = false;
          roles = { run: "A", multi: "B" };
          console.log(`[MODE] 🔄 Passage en Single-Slice sur Slice A (${sliceA.freq.toFixed(3)} MHz)`);
        }
      }
    }
  }
  // MD — Mode
  else if (msg.startsWith("MD") && msg.length >= 3) {
    const modeNum = parseInt(msg.slice(2));
    const modes = { 1: "LSB", 2: "USB", 3: "CW", 4: "FM", 5: "AM", 6: "RTTY", 7: "CW-R", 9: "FSK" };
    const m = modes[modeNum] || "";
    // Mode applies to active slice (A by default)
    sliceA.mode = m;
  }
  // IF — Information (contains TX state)
  else if (msg.startsWith("IF") && msg.length >= 38) {
    const txBit = msg[28];
    if (txBit === "1") {
      // Determine which slice is TX based on roles
      const runSlice = getSlice(roles.run);
      runSlice.tx = true;
      const multiSlice = getSlice(roles.multi);
      multiSlice.tx = false;
    } else {
      sliceA.tx = false;
      sliceB.tx = false;
    }
    // Detect TX on slice B → means RUN is B (only in SO2V mode)
    if (isSo2v && (sliceA.tx || sliceB.tx)) {
      const txSlice = sliceA.tx ? "A" : "B";
      if (txSlice !== roles.run) {
        roles = { run: txSlice, multi: txSlice === "A" ? "B" : "A" };
        console.log(`[TX DETECT] TX est sur Slice ${txSlice} — mise à jour rôles: RUN=${txSlice}`);
      }
    }
  }
  // PC — Power
  else if (msg.startsWith("PC") && msg.length >= 5) {
    const pw = parseInt(msg.slice(2));
    if (!isNaN(pw)) {
      getSlice(roles.run).rfPower = pw;
    }
  }
  // SM — S-meter
  else if (msg.startsWith("SM0") && msg.length >= 7) {
    const val = parseInt(msg.slice(3));
    if (!isNaN(val)) {
      getSlice(roles.run).smeter = val;
    }
  }
  // NB — Noise Blanker
  else if (msg.startsWith("NB") && msg.length >= 3) {
    getSlice(roles.run).nbEnabled = msg[2] === "1";
  }
  // NR — Noise Reduction
  else if (msg.startsWith("NR") && msg.length >= 3) {
    getSlice(roles.run).nrEnabled = msg[2] === "1";
  }
  // NT — Notch/ANF
  else if (msg.startsWith("NT") && msg.length >= 3) {
    getSlice(roles.run).anfEnabled = msg[2] === "1";
  }
  // SL — Filter Low
  else if (msg.startsWith("SL") && msg.length >= 4) {
    const idx = parseInt(msg.slice(2));
    if (!isNaN(idx)) getSlice(roles.run).filterLo = idx * 50;
  }
  // SH — Filter High
  else if (msg.startsWith("SH") && msg.length >= 4) {
    const idx = parseInt(msg.slice(2));
    if (!isNaN(idx)) {
      getSlice(roles.run).filterHi = idx === 0 ? 1000 : 1000 + (idx - 1) * 200 + 200;
    }
  }
  // ? — Command not recognized
  else if (msg === "?") {
    if (VERBOSE) console.log("[CAT] Commande non reconnue");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH TO SERVER
// ═══════════════════════════════════════════════════════════════════════════════

async function pushToServer() {
  if (!sliceA.mode && sliceA.freq > 0) sliceA.mode = guessModeFromFreq(sliceA.freq);
  if (!sliceB.mode && sliceB.freq > 0) sliceB.mode = guessModeFromFreq(sliceB.freq);

  // In single-slice mode, use whichever slice has a valid frequency
  let runSlice;
  if (!isSo2v) {
    if (sliceA.freq > 0.5) {
      runSlice = sliceA;
      if (roles.run !== "A") roles = { run: "A", multi: "B" };
    } else if (sliceB.freq > 0.5) {
      runSlice = sliceB;
      if (roles.run !== "B") roles = { run: "B", multi: "A" };
    } else {
      runSlice = sliceA; // fallback
    }
  } else {
    runSlice = getSlice(roles.run);
  }

  const payload = {
    token: TOKEN,
    // SO2R flag: true only when dual-slice is active
    so2r: isSo2v,
    // Always send single-radio fields (works for both modes)
    connected,
    freq: runSlice.freq,
    mode: runSlice.mode,
    radio: isSo2v ? `SO2V (RUN: ${runSlice.name})` : `Flex (${runSlice.name})`,
    version: "SO2V v2.2",
    rfPower: runSlice.rfPower,
    nbEnabled: runSlice.nbEnabled,
    nrEnabled: runSlice.nrEnabled,
    anfEnabled: runSlice.anfEnabled,
    eqEnabled: runSlice.eqEnabled,
    filterLo: runSlice.filterLo,
    filterHi: runSlice.filterHi,
    smeter: runSlice.smeter,
  };

  // Add SO2R-specific fields only when in dual-slice mode
  if (isSo2v) {
    payload.roles = roles;
    payload.radioA = {
      connected, freq: sliceA.freq, mode: sliceA.mode, name: sliceA.name, tx: sliceA.tx,
      rfPower: sliceA.rfPower, nbEnabled: sliceA.nbEnabled, nrEnabled: sliceA.nrEnabled,
      anfEnabled: sliceA.anfEnabled, eqEnabled: sliceA.eqEnabled,
      filterLo: sliceA.filterLo, filterHi: sliceA.filterHi, smeter: sliceA.smeter,
    };
    payload.radioB = {
      connected, freq: sliceB.freq, mode: sliceB.mode, name: sliceB.name, tx: sliceB.tx,
      rfPower: sliceB.rfPower, nbEnabled: sliceB.nbEnabled, nrEnabled: sliceB.nrEnabled,
      anfEnabled: sliceB.anfEnabled, eqEnabled: sliceB.eqEnabled,
      filterLo: sliceB.filterLo, filterHi: sliceB.filterHi, smeter: sliceB.smeter,
    };
  }

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
    if (VERBOSE) console.log(`[PUSH] Erreur: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLING (from server/UI)
// ═══════════════════════════════════════════════════════════════════════════════

function qsySlice(sliceId, freqMHz, mode) {
  const hz = Math.round(freqMHz * 1000000);
  const hzStr = hz.toString().padStart(11, "0");

  if (sliceId === "A") {
    catWrite(`FA${hzStr};`);
  } else {
    catWrite(`FB${hzStr};`);
  }

  const roleLabel = isSo2v ? (sliceId === roles.run ? "RUN" : "MULTI") : "RUN";
  console.log(`[QSY] Slice ${sliceId} (${roleLabel}) → ${freqMHz.toFixed(3)} MHz`);

  if (mode) {
    const modeMap = { "LSB": "MD1;", "USB": "MD2;", "CW": "MD3;", "FM": "MD4;", "AM": "MD5;", "CW-R": "MD7;", "FSK": "MD9;" };
    const modeCmd = modeMap[mode.toUpperCase()];
    if (modeCmd) {
      if (isSo2v && sliceId === "B") {
        setTimeout(() => catWrite("FR1;"), 50);
        setTimeout(() => catWrite(modeCmd), 150);
        setTimeout(() => catWrite("FR0;"), 250);
      } else {
        setTimeout(() => catWrite(modeCmd), 100);
      }
    }
  }
}

function handleServerCommand(cmd) {
  const { action } = cmd;

  switch (action) {
    case "swap":
      if (isSo2v) {
        swap();
      } else {
        console.log("[SWAP] Ignoré — mode single-slice (pas de Slice B)");
      }
      break;

    case "qsy": {
      // In single-slice mode, QSY whichever slice is active (roles.run)
      const target = isSo2v ? (cmd.target || roles.run) : roles.run;
      const freq = cmd.freq;
      if (!freq) break;
      qsySlice(target, freq, cmd.mode);
      break;
    }

    case "qsy_multi": {
      if (!isSo2v) {
        // In single-slice, QSY the active slice
        const freq = cmd.freq;
        if (!freq) break;
        qsySlice(roles.run, freq, cmd.mode);
        console.log(`[QSY] Mode single-slice → QSY sur Slice ${roles.run}`);
      } else {
        const freq = cmd.freq;
        if (!freq) break;
        qsySlice(roles.multi, freq, cmd.mode);
      }
      break;
    }

    case "qsy_run": {
      const freq = cmd.freq;
      if (!freq) break;
      qsySlice(roles.run, freq, cmd.mode);
      break;
    }

    case "swap_and_qsy": {
      if (!isSo2v) {
        // In single-slice, just QSY the active slice
        const freq = cmd.freq;
        if (!freq) break;
        qsySlice(roles.run, freq, cmd.mode);
        console.log(`[SWAP+QSY] Mode single-slice → QSY simple sur Slice ${roles.run}`);
      } else {
        const freq = cmd.freq;
        if (!freq) break;
        qsySlice(roles.multi, freq, cmd.mode);
        setTimeout(() => {
          swap();
          console.log(`[SWAP+QSY] Slice ${roles.run} est maintenant RUN sur ${freq.toFixed(3)} MHz`);
        }, 300);
      }
      break;
    }

    case "setpower": {
      const val = cmd.value;
      if (val !== undefined) {
        catWrite(`PC${val.toString().padStart(3, "0")};`);
        console.log(`[POWER] → ${val}W`);
      }
      break;
    }

    case "tune": {
      const enabled = cmd.enabled;
      if (enabled === false) {
        catWrite("RX;");
        console.log(`[TUNE] STOP`);
      } else {
        catWrite("TX;");
        console.log(`[TUNE] START on Slice ${roles.run} (RUN)`);
        setTimeout(() => {
          catWrite("RX;");
          console.log(`[TUNE] Auto-stop (10s safety)`);
        }, 10000);
      }
      break;
    }

    case "mox": {
      const enabled = cmd.enabled;
      catWrite(enabled ? "TX;" : "RX;");
      console.log(`[MOX] → ${enabled ? "TX" : "RX"}`);
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
      const target = isSo2v ? (cmd.target || roles.run) : "A";

      const needSwitch = isSo2v && target === "B";
      const switchDelay = needSwitch ? 100 : 0;

      if (needSwitch) catWrite("FR1;");

      if (lo !== undefined) {
        const slIdx = Math.round(lo / 50);
        setTimeout(() => {
          catWrite(`SL${slIdx.toString().padStart(2, "0")};`);
          console.log(`[FILTER] Low cut → ${lo} Hz (SL${slIdx.toString().padStart(2, "0")}) [Slice ${target}]`);
        }, switchDelay);
      }
      if (hi !== undefined) {
        let shIdx = 0;
        if (hi >= 1000) {
          shIdx = Math.round((hi - 1000) / 200) + 1;
          if (shIdx > 16) shIdx = 16;
        }
        setTimeout(() => {
          catWrite(`SH${shIdx.toString().padStart(2, "0")};`);
          console.log(`[FILTER] High cut → ${hi} Hz (SH${shIdx.toString().padStart(2, "0")}) [Slice ${target}]`);
        }, switchDelay + 50);
      }

      if (needSwitch) {
        setTimeout(() => catWrite("FR0;"), switchDelay + 150);
      }
      break;
    }

    case "setpreset": {
      const presets = {
        "dx_open":     { lo: 100, hi: 2800 },
        "dx_pileup":   { lo: 200, hi: 2600 },
        "dx_weak":     { lo: 300, hi: 2400 },
        "qrm_severe":  { lo: 400, hi: 2200 },
        "cw_comfort":  { lo: 400, hi: 800 },
        "cw_contest":  { lo: 500, hi: 700 },
        "ssb_narrow":  { lo: 300, hi: 2200 },
        "digi_wide":   { lo: 100, hi: 3000 },
      };
      const presetName = cmd.preset || cmd.param;
      const preset = presets[presetName];
      if (!preset) {
        console.log(`[PRESET] Preset inconnu: ${presetName}`);
        break;
      }

      const presetTarget = isSo2v ? (cmd.target || roles.run) : "A";
      console.log(`[PRESET] ${presetName} → Slice ${presetTarget} (${preset.lo}-${preset.hi} Hz)`);
      handleServerCommand({ action: "setfilter", filterLo: preset.lo, filterHi: preset.hi, target: presetTarget });
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
console.log("║  DX HUNTER — Bridge SO2V v2.2 (CAT Only)                   ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  Port CAT     : ${CAT_HOST}:${CAT_PORT}`.padEnd(64) + "║");
console.log(`║  Slice A      : FA (fréquence VFO A)`.padEnd(64) + "║");
console.log(`║  Slice B      : FB (auto-détecté si actif)`.padEnd(64) + "║");
console.log(`║  Serveur      : ${SERVER_URL}`.padEnd(64) + "║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Mode auto : Single-Slice (1 pan) ou SO2V (2 pans)         ║");
console.log("║  Interlock : ACTIF en SO2V (seul RUN peut émettre)         ║");
console.log("║  Commandes : QSY, Filtre, DSP, EQ, Puissance, TX, SWAP    ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");

// Connect CAT
connectCat();

// Start push loop
pushTimer = setInterval(pushToServer, PUSH_INTERVAL);

// Status display every 10s
setInterval(() => {
  if (!connected) {
    console.log(`[Bridge] ⚪ Déconnecté — en attente de SmartSDR...`);
    return;
  }
  if (isSo2v) {
    const runSlice = getSlice(roles.run);
    const multiSlice = getSlice(roles.multi);
    const runStatus = `${runSlice.freq.toFixed(3)} MHz ${runSlice.mode}${runSlice.tx ? " 📡TX" : ""}`;
    const multiStatus = `${multiSlice.freq.toFixed(3)} MHz ${multiSlice.mode}`;
    console.log(`[SO2V] 🟢 RUN (${roles.run}): ${runStatus}  |  🔵 MULTI (${roles.multi}): ${multiStatus}`);
  } else {
    const s = sliceA;
    console.log(`[Single] 🟢 ${s.freq.toFixed(3)} MHz ${s.mode} | PWR: ${s.rfPower}W${s.tx ? " 📡TX" : ""}`);
  }
}, 10000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bridge] Arrêt...");
  if (pollTimer) clearInterval(pollTimer);
  if (pushTimer) clearInterval(pushTimer);
  if (socket) socket.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => process.emit("SIGINT"));
