/**
 * Super Check Partial — fast in-memory callsign lookup.
 * Loads the MASTER.SCP file and provides partial matching.
 */
import { readFileSync } from "fs";
import { join } from "path";

let calls: string[] = [];
let loaded = false;

function loadScp(): void {
  if (loaded) return;
  try {
    const filePath = join(import.meta.dirname, "data", "MASTER.SCP");
    const content = readFileSync(filePath, "utf-8");
    calls = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"));
    loaded = true;
    console.log(`[SCP] Loaded ${calls.length} callsigns from MASTER.SCP`);
  } catch (err) {
    console.error("[SCP] Failed to load MASTER.SCP:", err);
    calls = [];
    loaded = true;
  }
}

/**
 * Search for callsigns matching a partial input.
 * Returns up to `limit` matches sorted by relevance.
 */
export function scpSearch(partial: string, limit = 10): string[] {
  loadScp();
  if (!partial || partial.length < 2) return [];

  const upper = partial.toUpperCase();
  const results: string[] = [];

  // Priority 1: starts with the partial
  for (const call of calls) {
    if (call.startsWith(upper)) {
      results.push(call);
      if (results.length >= limit * 2) break;
    }
  }

  // Priority 2: contains the partial (if not enough results)
  if (results.length < limit) {
    for (const call of calls) {
      if (!call.startsWith(upper) && call.includes(upper)) {
        results.push(call);
        if (results.length >= limit * 2) break;
      }
    }
  }

  // Sort: exact prefix first, then by length (shorter = more likely)
  results.sort((a, b) => {
    const aStarts = a.startsWith(upper) ? 0 : 1;
    const bStarts = b.startsWith(upper) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.length - b.length;
  });

  return results.slice(0, limit);
}

/** Get total number of callsigns in the SCP database */
export function scpCount(): number {
  loadScp();
  return calls.length;
}
