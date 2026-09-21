/**
 * MultiDetailPopover — Affiche les détails d'un multiplicateur au clic sur le badge MULTI.
 * Montre : pourquoi c'est un multi, les spots récents de ce DX (bandes, fréquences, modes).
 */
import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Zap, Radio, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spot, fmtFreq, BAND_COLORS } from "@/lib/dx";

interface MultiReason {
  type: string;
  value: string;
  label: string;
}

interface Props {
  /** Le spot MULTI sur lequel on a cliqué */
  spot: Spot;
  /** Tous les spots visibles (pour trouver les autres spots du même DX) */
  allSpots: Spot[];
  /** L'identifiant du concours actif */
  contestId: string | null | undefined;
  /** Les clés multi déjà travaillées (format "band:type:value") */
  workedMultKeys: string[];
  /** Callback QSY */
  onQsy?: (freqKhz: number, mode?: string) => void;
  catConnected?: boolean;
  children: React.ReactNode;
}

// Extraction des raisons multi (côté client)
function getMultiReasons(call: string, band: string, contestId: string, workedMultKeys: string[]): MultiReason[] {
  const reasons: MultiReason[] = [];
  const workedSet = new Set(workedMultKeys);

  const clean = call.split("/")[0].toUpperCase();

  // Extraire le préfixe pays
  let countryPrefix = "";
  if (clean[0] >= "0" && clean[0] <= "9") {
    const m = clean.match(/^(\d[A-Z]+)\d/);
    countryPrefix = m ? m[1] : clean.slice(0, 2);
  } else {
    const m = clean.match(/^([A-Z]+)\d/);
    countryPrefix = m ? m[1] : clean.slice(0, 2);
  }

  // Extraire le préfixe WPX
  let lastDigitIdx = -1;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (clean[i] >= "0" && clean[i] <= "9") { lastDigitIdx = i; break; }
  }
  const wpxPrefix = lastDigitIdx >= 0 ? clean.slice(0, lastDigitIdx + 1) : clean.slice(0, 2);

  // Table CQ zones simplifiée
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

  const guessCqZone = (p: string): number | undefined => {
    return PREFIX_CQ[p] || PREFIX_CQ[p.slice(0, 2)] || PREFIX_CQ[p[0]] || undefined;
  };

  if (contestId === "CQWW_SSB") {
    const zone = guessCqZone(countryPrefix);
    if (zone) {
      const key = `${band}:zone:${zone}`;
      if (!workedSet.has(key)) {
        reasons.push({ type: "zone", value: String(zone), label: `Zone CQ ${zone}` });
      }
    }
    const dxccKey = `${band}:dxcc:${countryPrefix}`;
    if (!workedSet.has(dxccKey)) {
      reasons.push({ type: "dxcc", value: countryPrefix, label: `DXCC ${countryPrefix}` });
    }
  } else if (contestId === "CQWPX_SSB") {
    const key = `${band}:prefix:${wpxPrefix}`;
    if (!workedSet.has(key)) {
      reasons.push({ type: "prefix", value: wpxPrefix, label: `Préfixe WPX ${wpxPrefix}` });
    }
  } else if (contestId === "REF_SSB") {
    const dxccKey = `${band}:dxcc:${countryPrefix}`;
    if (!workedSet.has(dxccKey)) {
      reasons.push({ type: "dxcc", value: countryPrefix, label: `DXCC ${countryPrefix}` });
    }
  } else if (contestId === "ARRL_DX") {
    // On ne peut pas deviner le state côté client
    reasons.push({ type: "state", value: "?", label: "State/Province (échange)" });
  } else if (contestId === "IOTA") {
    // IOTA : on ne peut pas deviner la référence depuis le call
    reasons.push({ type: "iota", value: "?", label: "Référence IOTA (échange)" });
  }

  return reasons;
}

export function MultiDetailPopover({ spot, allSpots, contestId, workedMultKeys, onQsy, catConnected, children }: Props) {
  // Trouver tous les spots récents du même DX call (30 dernières minutes)
  const relatedSpots = useMemo(() => {
    const thirtyMinAgo = Date.now() / 1000 - 1800;
    const dxCall = spot.dx_call.toUpperCase().split("/")[0];
    return allSpots
      .filter((s) => {
        const sCall = s.dx_call.toUpperCase().split("/")[0];
        return sCall === dxCall && s.received_time >= thirtyMinAgo;
      })
      .sort((a, b) => b.received_time - a.received_time)
      .slice(0, 10);
  }, [spot.dx_call, allSpots]);

  // Raisons du multi
  const reasons = useMemo(() => {
    if (!contestId) return [];
    return getMultiReasons(spot.dx_call, spot.band || "", contestId, workedMultKeys);
  }, [spot.dx_call, spot.band, contestId, workedMultKeys]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 border-amber-400/50 bg-[oklch(0.14_0.009_250)]"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-amber-400/30 px-3 py-2 bg-amber-400/10">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-xs font-bold text-amber-300">
            MULTI — {spot.dx_call}
          </span>
        </div>

        {/* Raisons du multi */}
        {reasons.length > 0 && (
          <div className="px-3 py-2 border-b border-border/50">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
              Nouveau multiplicateur
            </div>
            <div className="flex flex-wrap gap-1">
              {reasons.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40"
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Spots récents de ce DX */}
        <div className="px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Spots récents ({relatedSpots.length})
          </div>
          {relatedSpots.length === 0 ? (
            <div className="text-[10px] text-muted-foreground italic">Aucun spot récent</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {relatedSpots.map((s) => {
                const bandColor = BAND_COLORS[s.band || ""] || "#ffb000";
                const age = Math.round((Date.now() / 1000 - s.received_time) / 60);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors",
                      catConnected && onQsy ? "hover:bg-primary/10 cursor-pointer" : "bg-card/30"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (catConnected && onQsy) onQsy(s.freqKhz, s.mode || undefined);
                    }}
                    title={catConnected && onQsy ? `QSY → ${fmtFreq(s.freqKhz)} kHz` : undefined}
                  >
                    {/* Bande */}
                    <span
                      className="inline-block rounded px-1 py-0.5 font-mono text-[9px] font-bold"
                      style={{ color: bandColor, background: `${bandColor}1f`, border: `1px solid ${bandColor}55` }}
                    >
                      {s.band}
                    </span>
                    {/* Fréquence */}
                    <span className="font-mono text-[10px] font-semibold text-foreground tabular-nums">
                      {fmtFreq(s.freqKhz)}
                    </span>
                    {/* Mode */}
                    <span className="text-[9px] text-muted-foreground">
                      {s.mode || "?"}
                    </span>
                    {/* Âge */}
                    <span className="ml-auto text-[9px] text-muted-foreground/70">
                      {age < 1 ? "<1m" : `${age}m`}
                    </span>
                    {/* QSY arrow */}
                    {catConnected && onQsy && (
                      <ArrowRight className="h-2.5 w-2.5 text-primary/60" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source */}
        <div className="px-3 py-1.5 border-t border-border/30 flex items-center gap-1 text-[9px] text-muted-foreground/60">
          <Radio className="h-2.5 w-2.5" />
          {spot.de_call} · {spot.source}
        </div>
      </PopoverContent>
    </Popover>
  );
}
