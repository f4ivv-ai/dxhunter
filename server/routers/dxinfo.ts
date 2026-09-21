import { publicProcedure, router } from "../_core/trpc";

// ── Cache en mémoire (30 min) ──────────────────────────────────────────────
interface CacheEntry { data: unknown; ts: number }
const cache = new Map<string, CacheEntry>();
const TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key: string) {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < TTL) return e.data;
  return null;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// ── Parseur RSS minimal (sans dépendance externe) ─────────────────────────
interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  callsign?: string;
  dxccCode?: string;
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
      const match = r.exec(block);
      return match ? match[1].trim() : "";
    };
    const title = get("title");
    const link = get("link") || (/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "");
    const pubDate = get("pubDate");
    const description = get("description").replace(/<[^>]+>/g, "").trim().slice(0, 300);

    // Extraire l'indicatif depuis le titre (ex: "C5R – The Gambia" → "C5R")
    const callMatch = /^([A-Z0-9/]{2,10})\s*[–—-]/.exec(title);
    const callsign = callMatch ? callMatch[1] : undefined;

    items.push({ title, link, pubDate, description, callsign });
  }
  return items;
}

async function fetchRss(url: string): Promise<RssItem[]> {
  const cached = getCached(url);
  if (cached) return cached as RssItem[];

  const res = await fetch(url, {
    headers: { "User-Agent": "DXHunter/1.0 (ham radio app; contact: dx@example.com)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const items = parseRss(xml);
  setCached(url, items);
  return items;
}

export const dxinfoRouter = router({
  /** Flux RSS DX-World.net — expéditions récentes */
  dxworld: publicProcedure.query(async () => {
    try {
      const items = await fetchRss("https://www.dx-world.net/feed/");
      return { ok: true, items: items.slice(0, 25) };
    } catch (e) {
      return { ok: false, items: [], error: String(e) };
    }
  }),

  /** Flux RSS Amateur Radio Newsline — actualités radio générales */
  newsline: publicProcedure.query(async () => {
    try {
      const items = await fetchRss("https://www.arnewsline.org/?format=rss");
      return { ok: true, items: items.slice(0, 8) };
    } catch (e) {
      return { ok: false, items: [], error: String(e) };
    }
  }),
});
