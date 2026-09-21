#!/usr/bin/env node
/**
 * DX Daruma CAT Bridge — Universal Edition
 * 
 * Supporte :
 *   - FlexRadio 6000/8000 series (TCP/IP, SmartSDR API)
 *   - Hamlib rigctld (TCP, port 4532)
 *   - Yaesu (série RS-232/USB — FT-991, FT-DX10, FT-DX101, FT-710, FTDX3000...)
 *   - Icom CI-V (série USB — IC-7300, IC-7610, IC-7851, IC-9700...)
 *   - Kenwood (série RS-232/USB — TS-590, TS-890, TS-990, TS-480...)
 *   - Elecraft (série USB — K3, K3S, K4, KX3, KX2)
 *
 * Usage :
 *   node bridge.mjs --mode flex --radio 192.168.1.100
 *   node bridge.mjs --mode hamlib --host 127.0.0.1 --port 4532
 *   node bridge.mjs --mode yaesu --serial /dev/ttyUSB0 --baud 38400
 *   node bridge.mjs --mode icom --serial /dev/ttyUSB0 --baud 19200 --civ-addr 94
 *   node bridge.mjs --mode kenwood --serial COM3 --baud 115200
 *   node bridge.mjs --mode elecraft --serial /dev/ttyUSB0 --baud 38400
 *
 * Prérequis : 
 *   - Node.js 18+
 *   - Pour les modes série : npm install serialport
 *   - Pour FlexRadio et Hamlib : aucune dépendance externe
 */

import net from "node:net";
import dgram from "node:dgram";
import { createServer } from "node:http";
import { EventEmitter } from "node:events";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

// ─── CLI Arguments ───────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    mode: { type: "string", short: "m", default: "flex" },
    radio: { type: "string", short: "r", default: "" },
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string", default: "" },
    serial: { type: "string", default: "" },
    baud: { type: "string", short: "b", default: "" },
    "civ-addr": { type: "string", default: "94" },
    "ws-port": { type: "string", short: "p", default: "4993" },
    discover: { type: "boolean", short: "d", default: false },
    slice: { type: "string", short: "s", default: "0" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (args.help) {
  console.log(`
DX Daruma CAT Bridge — Universal Edition

Usage:
  node bridge.mjs --mode <type> [options]

Modes:
  flex       FlexRadio 6000/8000 (TCP/IP, SmartSDR API)
  hamlib     Hamlib rigctld (TCP, universel)
  yaesu      Yaesu FT-991/FT-DX10/FT-DX101/FT-710... (série)
  icom       Icom IC-7300/IC-7610/IC-7851/IC-9700... (série CI-V)
  kenwood    Kenwood TS-590/TS-890/TS-990/TS-480... (série)
  elecraft   Elecraft K3/K3S/K4/KX3/KX2 (série)

Options FlexRadio:
  --radio, -r <IP>     Adresse IP du FlexRadio
  --discover, -d       Auto-découverte UDP sur le réseau
  --slice, -s <n>      Numéro de slice (défaut: 0)

Options Hamlib:
  --host <IP>          Adresse du serveur rigctld (défaut: 127.0.0.1)
  --port <port>        Port rigctld (défaut: 4532)

Options Série (Yaesu/Icom/Kenwood/Elecraft):
  --serial <port>      Port série (ex: /dev/ttyUSB0, COM3, /dev/cu.usbserial-xxx)
  --baud, -b <rate>    Vitesse (défaut: 38400 Yaesu/Elecraft, 19200 Icom, 115200 Kenwood)
  --civ-addr <hex>     Adresse CI-V Icom en hex (défaut: 94 = IC-7300)

Options générales:
  --ws-port, -p <port> Port WebSocket pour DX Daruma (défaut: 4993)
  --help, -h           Afficher cette aide

Exemples:
  node bridge.mjs --mode flex --radio 192.168.1.100
  node bridge.mjs --mode flex --discover
  node bridge.mjs --mode hamlib --port 4532
  node bridge.mjs --mode yaesu --serial /dev/cu.usbserial-14310 --baud 38400
  node bridge.mjs --mode icom --serial COM4 --baud 19200 --civ-addr 94
  node bridge.mjs --mode kenwood --serial /dev/ttyUSB0 --baud 115200
  node bridge.mjs --mode elecraft --serial /dev/ttyACM0 --baud 38400
`);
  process.exit(0);
}

const MODE = args.mode.toLowerCase();
const WS_PORT = parseInt(args["ws-port"]);
const DEFAULT_SLICE = parseInt(args.slice);

// ─── Mode Mapping (DX mode → radio-specific) ────────────────────────────────

function mapModeForFlex(dxMode, freqMHz) {
  if (!dxMode) return null;
  const m = dxMode.toUpperCase();
  if (m === "SSB" || m === "PHONE") return freqMHz < 10 ? "lsb" : "usb";
  if (m === "USB") return "usb";
  if (m === "LSB") return "lsb";
  if (m === "CW") return "cw";
  if (["FT8", "FT4", "MFSK", "JT65", "JT9", "JS8"].includes(m)) return "digu";
  if (["RTTY", "PSK31", "PSK", "OLIVIA"].includes(m)) return "digl";
  if (m === "AM") return "am";
  if (m === "FM") return "fm";
  if (m === "DIGU") return "digu";
  if (m === "DIGL") return "digl";
  return freqMHz < 10 ? "lsb" : "usb";
}

function mapModeForYaesu(dxMode, freqMHz) {
  if (!dxMode) return null;
  const m = dxMode.toUpperCase();
  if (m === "SSB" || m === "PHONE") return freqMHz < 10 ? "1" : "2"; // LSB / USB
  if (m === "USB") return "2";
  if (m === "LSB") return "1";
  if (m === "CW") return "3";
  if (m === "AM") return "5";
  if (m === "FM") return "4";
  if (["FT8", "FT4", "MFSK", "JT65", "JT9", "JS8"].includes(m)) return "C"; // DATA-USB
  if (["RTTY", "PSK31", "PSK", "OLIVIA"].includes(m)) return "6"; // RTTY-LSB
  return freqMHz < 10 ? "1" : "2";
}

function mapModeForIcom(dxMode, freqMHz) {
  if (!dxMode) return null;
  const m = dxMode.toUpperCase();
  if (m === "SSB" || m === "PHONE") return freqMHz < 10 ? 0x00 : 0x01; // LSB / USB
  if (m === "USB") return 0x01;
  if (m === "LSB") return 0x00;
  if (m === "CW") return 0x03;
  if (m === "AM") return 0x02;
  if (m === "FM") return 0x05;
  if (["FT8", "FT4", "MFSK", "JT65", "JT9", "JS8", "RTTY", "PSK31", "PSK"].includes(m)) return 0x04; // RTTY
  return freqMHz < 10 ? 0x00 : 0x01;
}

function mapModeForKenwood(dxMode, freqMHz) {
  if (!dxMode) return null;
  const m = dxMode.toUpperCase();
  if (m === "SSB" || m === "PHONE") return freqMHz < 10 ? "1" : "2"; // LSB / USB
  if (m === "USB") return "2";
  if (m === "LSB") return "1";
  if (m === "CW") return "3";
  if (m === "AM") return "5";
  if (m === "FM") return "4";
  if (["FT8", "FT4", "MFSK", "JT65", "JT9", "JS8"].includes(m)) return "9"; // DATA
  if (["RTTY", "PSK31", "PSK"].includes(m)) return "6"; // FSK
  return freqMHz < 10 ? "1" : "2";
}

// ─── Abstract Radio Interface ────────────────────────────────────────────────

class RadioInterface extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.radioName = "Unknown";
    this.currentFreq = 0; // MHz
    this.currentMode = "";
  }
  async connect() { throw new Error("Not implemented"); }
  async qsy(freqMHz, mode) { throw new Error("Not implemented"); }
  async split(rxFreqMHz, txFreqMHz, mode) { throw new Error("Split not supported for this radio"); }
  async getFreq() { return this.currentFreq; }
  async getMode() { return this.currentMode; }
  getStatus() {
    return { connected: this.connected, radio: this.radioName, freq: this.currentFreq, mode: this.currentMode };
  }
  disconnect() { this.connected = false; }
}

// ─── FlexRadio Implementation ────────────────────────────────────────────────

class FlexRadio extends RadioInterface {
  constructor(ip, port = 4992, sliceId = 0) {
    super();
    this.ip = ip;
    this.port = port;
    this.sliceId = sliceId;
    this.socket = null;
    this.handle = null;
    this.version = null;
    this.seq = 1;
    this.pending = new Map();
    this.slices = new Map();
    this.buffer = "";
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.ip, () => {
        console.log(`[Flex] Connecté à ${this.ip}:${this.port}`);
        this.connected = true;
      });
      this.socket.setEncoding("utf8");
      this.socket.on("data", (d) => this._onData(d));
      this.socket.on("close", () => { this.connected = false; this.emit("disconnected"); });
      this.socket.on("error", (err) => { this.connected = false; reject(err); });

      // Wait for handle
      this.once("ready", async () => {
        try {
          await this._send("client program DXDaruma");
          await this._send("sub slice all");
          await this._send("slice list");
          this.radioName = `FlexRadio @ ${this.ip}`;
          resolve();
        } catch (e) { reject(e); }
      });
    });
  }

  _onData(data) {
    this.buffer += data;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t[0] === "V") { this.version = t.slice(1); }
      else if (t[0] === "H") { this.handle = t.slice(1); this.emit("ready"); }
      else if (t[0] === "R") { this._handleResp(t); }
      else if (t[0] === "S") { this._handleStatus(t); }
    }
  }

  _handleResp(line) {
    const parts = line.slice(1).split("|");
    const seq = parseInt(parts[0]);
    const hex = parts[1];
    const msg = parts[2] || "";
    const p = this.pending.get(seq);
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(seq);
      if (hex === "0" || hex === "00000000") p.resolve(msg);
      else p.reject(new Error(`Flex error 0x${hex}: ${msg}`));
    }
  }

  _handleStatus(line) {
    const i = line.indexOf("|");
    if (i < 0) return;
    const s = line.slice(i + 1);
    const m = s.match(/^slice (\d+) (.+)/);
    if (m) {
      const id = parseInt(m[1]);
      const slice = this.slices.get(id) || {};
      const re = /(\w+)=([^\s]+)/g;
      let match;
      while ((match = re.exec(m[2])) !== null) {
        if (match[1] === "RF_frequency") slice.freq = parseFloat(match[2]);
        else if (match[1] === "mode") slice.mode = match[2].toLowerCase();
      }
      this.slices.set(id, slice);
      if (id === this.sliceId) {
        this.currentFreq = slice.freq || 0;
        this.currentMode = slice.mode || "";
        this.emit("freq-change", { freq: this.currentFreq, mode: this.currentMode });
      }
    }
  }

  _send(cmd, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.connected) { reject(new Error("Not connected")); return; }
      const seq = this.seq++;
      const timer = setTimeout(() => { this.pending.delete(seq); reject(new Error(`Timeout: ${cmd}`)); }, timeout);
      this.pending.set(seq, { resolve, reject, timer });
      this.socket.write(`C${seq}|${cmd}\n`);
    });
  }

  async qsy(freqMHz, mode) {
    console.log(`[Flex] QSY → ${freqMHz.toFixed(3)} MHz, mode ${mode || "auto"}`);
    await this._send(`slice t ${this.sliceId} ${freqMHz.toFixed(6)}`);
    if (mode) {
      const flexMode = mapModeForFlex(mode, freqMHz);
      await this._send(`slice s ${this.sliceId} mode=${flexMode}`);
    }
    this.currentFreq = freqMHz;
    if (mode) this.currentMode = mode;
    return { success: true, freq: freqMHz, mode };
  }

  async split(rxFreqMHz, txFreqMHz, mode) {
    console.log(`[Flex] SPLIT → RX ${rxFreqMHz.toFixed(3)} / TX ${txFreqMHz.toFixed(3)} MHz`);
    // Set RX slice frequency
    await this._send(`slice t ${this.sliceId} ${rxFreqMHz.toFixed(6)}`);
    if (mode) {
      const flexMode = mapModeForFlex(mode, rxFreqMHz);
      await this._send(`slice s ${this.sliceId} mode=${flexMode}`);
    }
    // Enable XIT with offset for TX on different frequency
    const offsetHz = Math.round((txFreqMHz - rxFreqMHz) * 1e6);
    await this._send(`slice s ${this.sliceId} xit_on=1 xit_freq=${offsetHz}`);
    this.currentFreq = rxFreqMHz;
    return { success: true, rxFreq: rxFreqMHz, txFreq: txFreqMHz, mode };
  }

  disconnect() {
    if (this.socket) { this.socket.destroy(); this.socket = null; }
    this.connected = false;
  }
}

// ─── FlexRadio Discovery ─────────────────────────────────────────────────────

async function discoverRadio(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const timer = setTimeout(() => { sock.close(); reject(new Error("Aucun FlexRadio trouvé (timeout)")); }, timeout);
    sock.on("message", (msg) => {
      const text = msg.toString();
      if (text.includes("discovery_protocol_version")) {
        const ip = text.match(/ip=(\d+\.\d+\.\d+\.\d+)/);
        const model = text.match(/model=([^\s]+)/);
        if (ip) { clearTimeout(timer); sock.close(); console.log(`[Discovery] ${model?.[1] || "FlexRadio"} @ ${ip[1]}`); resolve(ip[1]); }
      }
    });
    sock.bind(4992, () => { sock.setBroadcast(true); console.log("[Discovery] Recherche FlexRadio..."); });
  });
}

// ─── Hamlib rigctld Implementation ───────────────────────────────────────────

class HamlibRadio extends RadioInterface {
  constructor(host = "127.0.0.1", port = 4532) {
    super();
    this.host = host;
    this.port = port;
    this.socket = null;
    this.buffer = "";
    this.pending = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host, () => {
        console.log(`[Hamlib] Connecté à rigctld ${this.host}:${this.port}`);
        this.connected = true;
        this.radioName = `Hamlib rigctld @ ${this.host}:${this.port}`;
        resolve();
      });
      this.socket.setEncoding("utf8");
      this.socket.on("data", (d) => this._onData(d));
      this.socket.on("close", () => { this.connected = false; this.emit("disconnected"); });
      this.socket.on("error", (err) => { this.connected = false; reject(err); });
    });
  }

  _onData(data) {
    this.buffer += data;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      if (this.pending.length > 0) {
        const p = this.pending.shift();
        p.resolve(line.trim());
      }
    }
  }

  _cmd(command) {
    return new Promise((resolve, reject) => {
      if (!this.connected) { reject(new Error("Not connected")); return; }
      const timer = setTimeout(() => reject(new Error(`Timeout: ${command}`)), 5000);
      this.pending.push({ resolve: (v) => { clearTimeout(timer); resolve(v); }, reject });
      this.socket.write(command + "\n");
    });
  }

  async qsy(freqMHz, mode) {
    const freqHz = Math.round(freqMHz * 1e6);
    console.log(`[Hamlib] QSY → ${freqMHz.toFixed(3)} MHz (${freqHz} Hz), mode ${mode || "auto"}`);
    await this._cmd(`F ${freqHz}`);
    if (mode) {
      const m = mode.toUpperCase();
      let hamlibMode = m;
      if (m === "SSB" || m === "PHONE") hamlibMode = freqMHz < 10 ? "LSB" : "USB";
      if (["FT8", "FT4", "JT65", "JT9", "JS8", "MFSK"].includes(m)) hamlibMode = "USB"; // data modes via USB
      await this._cmd(`M ${hamlibMode} 0`);
    }
    this.currentFreq = freqMHz;
    if (mode) this.currentMode = mode;
    return { success: true, freq: freqMHz, mode };
  }

  async getFreq() {
    try {
      const resp = await this._cmd("f");
      this.currentFreq = parseInt(resp) / 1e6;
    } catch { /* ignore */ }
    return this.currentFreq;
  }

  disconnect() {
    if (this.socket) { this.socket.destroy(); this.socket = null; }
    this.connected = false;
  }
}

// ─── Serial Radio Implementation (Yaesu / Kenwood / Elecraft) ────────────────

class SerialTextRadio extends RadioInterface {
  constructor(portPath, baudRate, protocol = "yaesu") {
    super();
    this.portPath = portPath;
    this.baudRate = baudRate;
    this.protocol = protocol; // yaesu, kenwood, elecraft
    this.serialPort = null;
    this.buffer = "";
  }

  async connect() {
    // Dynamic import of serialport (optional dependency)
    let SerialPort;
    try {
      const sp = await import("serialport");
      SerialPort = sp.SerialPort || sp.default?.SerialPort;
    } catch {
      throw new Error(
        "Le package 'serialport' est requis pour le mode série.\n" +
        "Installez-le avec : npm install serialport"
      );
    }

    return new Promise((resolve, reject) => {
      this.serialPort = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: this.protocol === "yaesu" ? 2 : 1,
        parity: "none",
        autoOpen: false,
      });

      this.serialPort.open((err) => {
        if (err) { reject(new Error(`Impossible d'ouvrir ${this.portPath}: ${err.message}`)); return; }
        console.log(`[${this.protocol.toUpperCase()}] Port série ouvert : ${this.portPath} @ ${this.baudRate} baud`);
        this.connected = true;
        this.radioName = `${this.protocol.toUpperCase()} @ ${this.portPath}`;
        resolve();
      });

      this.serialPort.on("data", (buf) => {
        this.buffer += buf.toString("utf8");
        this._processBuffer();
      });

      this.serialPort.on("close", () => { this.connected = false; this.emit("disconnected"); });
      this.serialPort.on("error", (err) => { console.error(`[Serial] Erreur: ${err.message}`); });
    });
  }

  _processBuffer() {
    // Commands terminated by ";"
    let idx;
    while ((idx = this.buffer.indexOf(";")) !== -1) {
      const response = this.buffer.slice(0, idx + 1);
      this.buffer = this.buffer.slice(idx + 1);
      this._handleResponse(response);
    }
  }

  _handleResponse(resp) {
    // Parse frequency response
    if (resp.startsWith("FA")) {
      const freqStr = resp.slice(2, -1);
      const freqHz = parseInt(freqStr);
      if (!isNaN(freqHz)) {
        this.currentFreq = freqHz / 1e6;
        this.emit("freq-change", { freq: this.currentFreq, mode: this.currentMode });
      }
    }
    if (resp.startsWith("MD")) {
      const modeCode = resp.slice(2, -1).replace("0", ""); // Remove VFO prefix for Yaesu
      this.currentMode = modeCode;
      this.emit("freq-change", { freq: this.currentFreq, mode: this.currentMode });
    }
    if (this._pendingResolve) {
      this._pendingResolve(resp);
      this._pendingResolve = null;
    }
  }

  _write(cmd) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.serialPort) { reject(new Error("Not connected")); return; }
      this._pendingResolve = resolve;
      setTimeout(() => { if (this._pendingResolve === resolve) { this._pendingResolve = null; resolve(""); } }, 3000);
      this.serialPort.write(cmd);
    });
  }

  async qsy(freqMHz, mode) {
    const freqHz = Math.round(freqMHz * 1e6);
    console.log(`[${this.protocol.toUpperCase()}] QSY → ${freqMHz.toFixed(3)} MHz, mode ${mode || "auto"}`);

    if (this.protocol === "yaesu") {
      // Yaesu: FA + 9 digits (Hz)
      const freqCmd = `FA${String(freqHz).padStart(9, "0")};`;
      await this._write(freqCmd);
      if (mode) {
        const modeCode = mapModeForYaesu(mode, freqMHz);
        await this._write(`MD0${modeCode};`);
      }
    } else {
      // Kenwood / Elecraft: FA + 11 digits (Hz)
      const freqCmd = `FA${String(freqHz).padStart(11, "0")};`;
      await this._write(freqCmd);
      if (mode) {
        const modeCode = mapModeForKenwood(mode, freqMHz);
        await this._write(`MD${modeCode};`);
      }
    }

    this.currentFreq = freqMHz;
    if (mode) this.currentMode = mode;
    return { success: true, freq: freqMHz, mode };
  }

  async getFreq() {
    try {
      const resp = await this._write("FA;");
      if (resp.startsWith("FA")) {
        const hz = parseInt(resp.slice(2, -1));
        if (!isNaN(hz)) this.currentFreq = hz / 1e6;
      }
    } catch { /* ignore */ }
    return this.currentFreq;
  }

  disconnect() {
    if (this.serialPort) { this.serialPort.close(); this.serialPort = null; }
    this.connected = false;
  }
}

// ─── Icom CI-V Implementation ────────────────────────────────────────────────

class IcomRadio extends RadioInterface {
  constructor(portPath, baudRate, civAddr = 0x94) {
    super();
    this.portPath = portPath;
    this.baudRate = baudRate;
    this.civAddr = civAddr; // Radio CI-V address
    this.ctrlAddr = 0xe0;  // Controller address (PC)
    this.serialPort = null;
    this.buffer = Buffer.alloc(0);
  }

  async connect() {
    let SerialPort;
    try {
      const sp = await import("serialport");
      SerialPort = sp.SerialPort || sp.default?.SerialPort;
    } catch {
      throw new Error(
        "Le package 'serialport' est requis pour le mode série.\n" +
        "Installez-le avec : npm install serialport"
      );
    }

    return new Promise((resolve, reject) => {
      this.serialPort = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        autoOpen: false,
      });

      this.serialPort.open((err) => {
        if (err) { reject(new Error(`Impossible d'ouvrir ${this.portPath}: ${err.message}`)); return; }
        console.log(`[ICOM] Port CI-V ouvert : ${this.portPath} @ ${this.baudRate} baud (addr 0x${this.civAddr.toString(16)})`);
        this.connected = true;
        this.radioName = `Icom CI-V (0x${this.civAddr.toString(16)}) @ ${this.portPath}`;
        resolve();
      });

      this.serialPort.on("data", (buf) => {
        this.buffer = Buffer.concat([this.buffer, buf]);
        this._processBuffer();
      });

      this.serialPort.on("close", () => { this.connected = false; this.emit("disconnected"); });
      this.serialPort.on("error", (err) => { console.error(`[ICOM] Erreur: ${err.message}`); });
    });
  }

  _processBuffer() {
    // Find complete CI-V frames (FE FE ... FD)
    while (true) {
      const start = this.buffer.indexOf(Buffer.from([0xfe, 0xfe]));
      if (start < 0) { this.buffer = Buffer.alloc(0); break; }
      const end = this.buffer.indexOf(0xfd, start + 2);
      if (end < 0) break; // Incomplete frame
      const frame = this.buffer.slice(start, end + 1);
      this.buffer = this.buffer.slice(end + 1);
      this._handleFrame(frame);
    }
  }

  _handleFrame(frame) {
    // FE FE <to> <from> <cmd> [<sub>] [<data>...] FD
    if (frame.length < 6) return;
    const to = frame[2];
    const from = frame[3];
    const cmd = frame[4];

    // Only process frames addressed to us
    if (to !== this.ctrlAddr) return;

    if (cmd === 0x03 || cmd === 0x00) {
      // Frequency response (BCD, 5 bytes, little-endian)
      if (frame.length >= 10) {
        const bcdBytes = frame.slice(5, 10);
        const freqHz = this._bcdToFreq(bcdBytes);
        this.currentFreq = freqHz / 1e6;
        this.emit("freq-change", { freq: this.currentFreq, mode: this.currentMode });
      }
    }

    if (this._pendingResolve) {
      this._pendingResolve(frame);
      this._pendingResolve = null;
    }
  }

  _bcdToFreq(bytes) {
    // CI-V BCD: 5 bytes, little-endian, 2 digits per byte
    let freq = 0;
    let mult = 1;
    for (let i = 0; i < bytes.length; i++) {
      const lo = bytes[i] & 0x0f;
      const hi = (bytes[i] >> 4) & 0x0f;
      freq += lo * mult;
      mult *= 10;
      freq += hi * mult;
      mult *= 10;
    }
    return freq;
  }

  _freqToBcd(freqHz) {
    // Convert Hz to 5-byte BCD little-endian
    const buf = Buffer.alloc(5);
    let f = Math.round(freqHz);
    for (let i = 0; i < 5; i++) {
      const lo = f % 10; f = Math.floor(f / 10);
      const hi = f % 10; f = Math.floor(f / 10);
      buf[i] = (hi << 4) | lo;
    }
    return buf;
  }

  _buildFrame(cmd, data = Buffer.alloc(0)) {
    const frame = Buffer.alloc(5 + data.length);
    frame[0] = 0xfe;
    frame[1] = 0xfe;
    frame[2] = this.civAddr; // to radio
    frame[3] = this.ctrlAddr; // from PC
    frame[4] = cmd;
    data.copy(frame, 5);
    return Buffer.concat([frame, Buffer.from([0xfd])]);
  }

  _sendFrame(frame) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.serialPort) { reject(new Error("Not connected")); return; }
      this._pendingResolve = resolve;
      setTimeout(() => { if (this._pendingResolve === resolve) { this._pendingResolve = null; resolve(null); } }, 3000);
      this.serialPort.write(frame);
    });
  }

  async qsy(freqMHz, mode) {
    const freqHz = Math.round(freqMHz * 1e6);
    console.log(`[ICOM] QSY → ${freqMHz.toFixed(3)} MHz, mode ${mode || "auto"}`);

    // Set frequency (Cmd 0x05)
    const bcd = this._freqToBcd(freqHz);
    const freqFrame = this._buildFrame(0x05, bcd);
    await this._sendFrame(freqFrame);

    // Set mode (Cmd 0x06)
    if (mode) {
      const modeCode = mapModeForIcom(mode, freqMHz);
      const modeData = Buffer.from([modeCode, 0x01]); // mode + FIL1
      const modeFrame = this._buildFrame(0x06, modeData);
      await this._sendFrame(modeFrame);
    }

    this.currentFreq = freqMHz;
    if (mode) this.currentMode = mode;
    return { success: true, freq: freqMHz, mode };
  }

  async getFreq() {
    try {
      const frame = this._buildFrame(0x03);
      await this._sendFrame(frame);
    } catch { /* ignore */ }
    return this.currentFreq;
  }

  disconnect() {
    if (this.serialPort) { this.serialPort.close(); this.serialPort = null; }
    this.connected = false;
  }
}

// ─── WebSocket Server (minimal, no deps) ─────────────────────────────────────

function acceptWebSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  const accept = createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-5AB5A4F2CE34")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    "Access-Control-Allow-Origin: *\r\n" +
    "\r\n"
  );
  return new WsConn(socket);
}

class WsConn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.alive = true;
    socket.on("data", (buf) => this._parse(buf));
    socket.on("close", () => { this.alive = false; this.emit("close"); });
    socket.on("error", () => { this.alive = false; this.emit("close"); });
  }

  _parse(buf) {
    let off = 0;
    while (off < buf.length) {
      if (buf.length - off < 2) break;
      const b1 = buf[off], b2 = buf[off + 1];
      const opcode = b1 & 0x0f;
      const masked = (b2 & 0x80) !== 0;
      let len = b2 & 0x7f;
      off += 2;
      if (len === 126) { if (buf.length - off < 2) break; len = buf.readUInt16BE(off); off += 2; }
      else if (len === 127) { if (buf.length - off < 8) break; len = Number(buf.readBigUInt64BE(off)); off += 8; }
      let mask = null;
      if (masked) { if (buf.length - off < 4) break; mask = buf.slice(off, off + 4); off += 4; }
      if (buf.length - off < len) break;
      const payload = buf.slice(off, off + len); off += len;
      if (masked && mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      if (opcode === 0x01) { try { this.emit("message", JSON.parse(payload.toString())); } catch {} }
      else if (opcode === 0x08) { this.alive = false; this.socket.end(); this.emit("close"); }
      else if (opcode === 0x09) { this._frame(0x0a, payload); }
    }
  }

  send(data) { this._frame(0x01, Buffer.from(JSON.stringify(data))); }

  _frame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.alloc(2); header[0] = 0x80 | opcode; header[1] = len; }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    if (this.socket.writable) this.socket.write(Buffer.concat([header, payload]));
  }

  close() { this._frame(0x08, Buffer.alloc(0)); this.socket.end(); }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let radio;

  switch (MODE) {
    case "flex": {
      let ip = args.radio;
      if (!ip && args.discover) ip = await discoverRadio();
      if (!ip) { console.error("Erreur: --radio <IP> ou --discover requis pour le mode flex"); process.exit(1); }
      radio = new FlexRadio(ip, 4992, DEFAULT_SLICE);
      break;
    }

    case "hamlib": {
      const host = args.host;
      const port = parseInt(args.port || "4532");
      radio = new HamlibRadio(host, port);
      break;
    }

    case "yaesu": {
      if (!args.serial) { console.error("Erreur: --serial <port> requis pour le mode yaesu"); process.exit(1); }
      const baud = parseInt(args.baud || "38400");
      radio = new SerialTextRadio(args.serial, baud, "yaesu");
      break;
    }

    case "kenwood": {
      if (!args.serial) { console.error("Erreur: --serial <port> requis pour le mode kenwood"); process.exit(1); }
      const baud = parseInt(args.baud || "115200");
      radio = new SerialTextRadio(args.serial, baud, "kenwood");
      break;
    }

    case "elecraft": {
      if (!args.serial) { console.error("Erreur: --serial <port> requis pour le mode elecraft"); process.exit(1); }
      const baud = parseInt(args.baud || "38400");
      radio = new SerialTextRadio(args.serial, baud, "elecraft");
      break;
    }

    case "icom": {
      if (!args.serial) { console.error("Erreur: --serial <port> requis pour le mode icom"); process.exit(1); }
      const baud = parseInt(args.baud || "19200");
      const civAddr = parseInt(args["civ-addr"], 16);
      radio = new IcomRadio(args.serial, baud, civAddr);
      break;
    }

    default:
      console.error(`Mode inconnu: ${MODE}. Utilisez: flex, hamlib, yaesu, icom, kenwood, elecraft`);
      process.exit(1);
  }

  // Connect to radio
  console.log(`\n[Bridge] Mode: ${MODE.toUpperCase()}`);
  await radio.connect();

  // WebSocket server
  const wsClients = new Set();

  const httpServer = createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
      res.end(); return;
    }
    if (req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ...radio.getStatus(), mode_bridge: MODE }));
      return;
    }
    res.writeHead(404); res.end("Not found");
  });

  httpServer.on("upgrade", (req, socket) => {
    if (req.url === "/ws" || req.url === "/") {
      const ws = acceptWebSocket(req, socket);
      wsClients.add(ws);
      console.log(`[WS] Client connecté (${wsClients.size})`);
      ws.send({ type: "status", ...radio.getStatus(), mode_bridge: MODE });

      ws.on("message", async (msg) => {
        try {
          if (msg.action === "qsy") {
            if (!msg.freq || typeof msg.freq !== "number") { ws.send({ type: "error", message: "freq (MHz) requis" }); return; }
            const result = await radio.qsy(msg.freq, msg.mode);
            ws.send({ type: "qsy-ok", ...result });
            // Broadcast to all clients
            for (const c of wsClients) { if (c !== ws && c.alive) c.send({ type: "qsy-ok", ...result }); }
          } else if (msg.action === "split") {
            // Split: TX on one freq, RX on another
            if (!msg.rxFreq || !msg.txFreq) { ws.send({ type: "error", message: "rxFreq et txFreq (MHz) requis" }); return; }
            const result = await radio.split(msg.rxFreq, msg.txFreq, msg.mode);
            ws.send({ type: "split-ok", ...result });
            for (const c of wsClients) { if (c !== ws && c.alive) c.send({ type: "split-ok", ...result }); }
          } else if (msg.action === "status") {
            ws.send({ type: "status", ...radio.getStatus(), mode_bridge: MODE });
          } else {
            ws.send({ type: "error", message: `Action inconnue: ${msg.action}` });
          }
        } catch (err) {
          ws.send({ type: "error", message: err.message });
        }
      });

      ws.on("close", () => { wsClients.delete(ws); console.log(`[WS] Client déconnecté (${wsClients.size})`); });
    }
  });

  // Broadcast freq changes
  radio.on("freq-change", (info) => {
    for (const ws of wsClients) { if (ws.alive) ws.send({ type: "freq-change", ...info }); }
  });

  radio.on("disconnected", () => {
    for (const ws of wsClients) { if (ws.alive) ws.send({ type: "status", connected: false }); }
    console.log("[Radio] Déconnecté. Reconnexion dans 5s...");
    setTimeout(() => { radio.connect().catch(() => {}); }, 5000);
  });

  httpServer.listen(WS_PORT, "0.0.0.0", () => {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  DX Daruma CAT Bridge — Universal Edition                    ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  Mode      : ${MODE.toUpperCase().padEnd(47)}║`);
    console.log(`║  Radio     : ${radio.radioName.padEnd(47)}║`);
    console.log(`║  WebSocket : ws://localhost:${String(WS_PORT).padEnd(33)}║`);
    console.log(`║  Status    : http://localhost:${String(WS_PORT).padEnd(31)}║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  Commandes WebSocket :                                       ║`);
    console.log(`║    { "action": "qsy", "freq": 14.205, "mode": "USB" }       ║`);
    console.log(`║    { "action": "status" }                                    ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => { console.log("\n[Bridge] Arrêt..."); radio.disconnect(); httpServer.close(); process.exit(0); });
}

main().catch((err) => { console.error("[Bridge] Erreur fatale:", err.message); process.exit(1); });
