/**
 * QRZ.com XML API integration for callsign lookup.
 * Uses session-based authentication with username/password.
 */

const QRZ_BASE = "https://xmldata.qrz.com/xml/current/";

let sessionKey: string | null = null;
let sessionExpiry = 0;

interface QrzCallInfo {
  call: string;
  fname: string | null;
  name: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  grid: string | null;
  lat: number | null;
  lon: number | null;
  cqzone: number | null;
  ituzone: number | null;
  continent: string | null;
  dxcc: number | null;
  iota: string | null;
}

/** Get or refresh QRZ session key */
async function getSession(): Promise<string> {
  const now = Date.now();
  if (sessionKey && now < sessionExpiry) return sessionKey;

  const username = process.env.QRZ_USERNAME;
  const password = process.env.QRZ_PASSWORD;
  if (!username || !password) {
    throw new Error("QRZ_USERNAME and QRZ_PASSWORD are required");
  }

  const url = `${QRZ_BASE}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&agent=DXHunter/1.0`;
  const resp = await fetch(url);
  const text = await resp.text();

  const keyMatch = text.match(/<Key>([^<]+)<\/Key>/);
  if (!keyMatch) {
    const errMatch = text.match(/<Error>([^<]+)<\/Error>/);
    throw new Error(`QRZ login failed: ${errMatch?.[1] || "unknown error"}`);
  }

  sessionKey = keyMatch[1];
  // Sessions last ~24h, refresh every 12h to be safe
  sessionExpiry = now + 12 * 60 * 60 * 1000;
  return sessionKey;
}

/** Lookup a callsign on QRZ.com */
export async function qrzLookup(callsign: string): Promise<QrzCallInfo | null> {
  try {
    const key = await getSession();
    const url = `${QRZ_BASE}?s=${key}&callsign=${encodeURIComponent(callsign.toUpperCase())}`;
    const resp = await fetch(url);
    const text = await resp.text();

    // Check for session expiry
    if (text.includes("<Error>Session Timeout") || text.includes("<Error>Invalid session")) {
      sessionKey = null;
      sessionExpiry = 0;
      // Retry once
      const newKey = await getSession();
      const retryUrl = `${QRZ_BASE}?s=${newKey}&callsign=${encodeURIComponent(callsign.toUpperCase())}`;
      const retryResp = await fetch(retryUrl);
      const retryText = await retryResp.text();
      return parseQrzResponse(retryText, callsign);
    }

    return parseQrzResponse(text, callsign);
  } catch (err) {
    console.error(`[QRZ] Lookup failed for ${callsign}:`, err);
    return null;
  }
}

function parseQrzResponse(xml: string, callsign: string): QrzCallInfo | null {
  if (xml.includes("<Error>Not found")) return null;

  const extract = (tag: string): string | null => {
    const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return m ? m[1] : null;
  };

  const latStr = extract("lat");
  const lonStr = extract("lon");
  const cqStr = extract("cqzone");
  const ituStr = extract("ituzone");
  const dxccStr = extract("dxcc");

  return {
    call: extract("call") || callsign.toUpperCase(),
    fname: extract("fname"),
    name: extract("name_fmt") || extract("name"),
    country: extract("country"),
    state: extract("state"),
    city: extract("addr2") || extract("addr1"),
    grid: extract("grid"),
    lat: latStr ? parseFloat(latStr) : null,
    lon: lonStr ? parseFloat(lonStr) : null,
    cqzone: cqStr ? parseInt(cqStr) : null,
    ituzone: ituStr ? parseInt(ituStr) : null,
    continent: extract("cont"),
    dxcc: dxccStr ? parseInt(dxccStr) : null,
    iota: extract("iota"),
  };
}

/** Test QRZ connection (lightweight) */
export async function qrzTestConnection(): Promise<boolean> {
  try {
    await getSession();
    return true;
  } catch {
    return false;
  }
}
