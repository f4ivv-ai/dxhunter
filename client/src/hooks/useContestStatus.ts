/**
 * useContestStatus — fournit le statut contest (multi/done/todo) pour chaque spot.
 * Interroge le backend toutes les 5s pour obtenir les données de travail,
 * puis calcule le statut côté client pour chaque spot visible.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export type SpotContestStatus = "multi" | "done" | "todo" | null;

// Table simplifiée préfixe → zone CQ (côté client)
const PREFIX_CQ: Record<string, number> = {
  F: 14, DL: 14, G: 14, I: 15, EA: 14, CT: 14, PA: 14, ON: 14, HB: 14,
  OE: 15, OK: 15, SP: 15, HA: 15, YU: 15, LZ: 15, SV: 20, OH: 18,
  SM: 14, LA: 14, OZ: 14, EI: 14, GM: 14, GW: 14, GI: 14,
  UR: 16, UA: 16, LY: 15, ES: 15, YL: 15, OM: 15, S5: 15,
  "9A": 15, T7: 14, "3A": 14, HV: 15,
  W: 3, K: 4, N: 5, AA: 3, AB: 4, VE: 2, VA: 2, VO: 2, VY: 1,
  XE: 6, TI: 7, HP: 7, HR: 7, YS: 7,
  LU: 13, PY: 11, CE: 12, CX: 13, HC: 10, OA: 10, YV: 9, HK: 9,
  ZS: 38, "5Z": 37, "5H": 37, "5N": 35, CN: 33, "7X": 33, SU: 34,
  "3V": 33, "5T": 35, "6W": 35, TU: 35, "9G": 35, EL: 35,
  JA: 25, BV: 24, HL: 25, VU: 22, A4: 21, A6: 21, A7: 21,
  "9K": 21, HZ: 21, "4X": 20, OD: 20, TA: 20,
  VK: 29, ZL: 32, KH6: 31, FK: 32, FO: 32,
};

function guessCqZone(prefix: string): number | undefined {
  if (!prefix) return undefined;
  const u = prefix.toUpperCase();
  return PREFIX_CQ[u] || PREFIX_CQ[u.slice(0, 2)] || PREFIX_CQ[u[0]] || undefined;
}

function extractWpxPrefix(call: string): string {
  if (!call) return "";
  const clean = call.split("/")[0].toUpperCase();
  let lastDigitIdx = -1;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (clean[i] >= "0" && clean[i] <= "9") { lastDigitIdx = i; break; }
  }
  if (lastDigitIdx === -1) return clean.slice(0, 2);
  return clean.slice(0, lastDigitIdx + 1);
}

function extractCountryPrefix(call: string): string {
  if (!call) return "";
  const clean = call.split("/")[0].toUpperCase();
  if (clean[0] >= "0" && clean[0] <= "9") {
    const m = clean.match(/^(\d[A-Z]+)\d/);
    return m ? m[1] : clean.slice(0, 2);
  }
  const m = clean.match(/^([A-Z]+)\d/);
  return m ? m[1] : clean.slice(0, 2);
}

// Règles multi par concours (côté client)
type MultiExtractor = (call: string, band: string) => { type: string; value: string }[];

const CONTEST_MULTI_RULES: Record<string, MultiExtractor> = {
  CQWW_SSB: (call, band) => {
    const prefix = extractCountryPrefix(call);
    const zone = guessCqZone(prefix);
    const mults: { type: string; value: string }[] = [];
    if (zone) mults.push({ type: "zone", value: String(zone) });
    if (prefix) mults.push({ type: "dxcc", value: prefix });
    return mults;
  },
  CQWPX_SSB: (call, band) => {
    const prefix = extractWpxPrefix(call);
    return prefix ? [{ type: "prefix", value: prefix }] : [];
  },
  ARRL_DX: (call, band) => {
    // Côté client on ne peut pas deviner le state — on ne marque pas multi
    return [];
  },
  REF_SSB: (call, band) => {
    const prefix = extractCountryPrefix(call);
    const mults: { type: string; value: string }[] = [];
    if (prefix) mults.push({ type: "dxcc", value: prefix });
    return mults;
  },
  IOTA: (call, band) => {
    // Côté client, on ne peut pas extraire la réf IOTA du call seul.
    // Les spots avec IOTA dans le commentaire seront marqués via le backend.
    // On ne marque pas "multi" côté client pour éviter les faux positifs.
    return [];
  },
};

interface SpotLike {
  id: string;
  dx_call: string;
  band?: string | null;
}

/**
 * Hook principal — retourne une map id → status.
 */
export function useContestStatus(spots: SpotLike[], enabled: boolean) {
  const { data: workedData } = trpc.contest.getWorkedData.useQuery(undefined, {
    enabled,
    refetchInterval: 5000,
  });

  const statusMap = useMemo(() => {
    const map = new Map<string, SpotContestStatus>();
    if (!enabled || !workedData?.active || !workedData.worked) return map;

    const { callsByBand, multKeys } = workedData.worked;
    const contestId = workedData.contestId || "";
    const extractor = CONTEST_MULTI_RULES[contestId];

    // Convert callsByBand arrays to Sets for fast lookup
    const callSets: Record<string, Set<string>> = {};
    for (const [band, calls] of Object.entries(callsByBand)) {
      callSets[band] = new Set(calls.map((c: string) => c.toUpperCase()));
    }
    const multSet = new Set(multKeys);

    for (const spot of spots) {
      const call = spot.dx_call?.toUpperCase().split("/")[0] || "";
      const band = spot.band || "";

      // 1. Déjà fait ?
      if (callSets[band]?.has(call)) {
        map.set(spot.id, "done");
        continue;
      }

      // 2. Nouveau multi ?
      if (extractor) {
        const candidates = extractor(call, band);
        let isMulti = false;
        for (const cand of candidates) {
          const key = `${band}:${cand.type}:${cand.value}`;
          if (!multSet.has(key)) {
            isMulti = true;
            break;
          }
        }
        if (isMulti) {
          map.set(spot.id, "multi");
          continue;
        }
      }

      // 3. À faire
      map.set(spot.id, "todo");
    }

    return map;
  }, [spots, enabled, workedData]);

  return { statusMap, contestActive: workedData?.active || false, contestId: workedData?.contestId };
}
