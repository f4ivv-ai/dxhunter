import { Spot, TRACKED_BANDS, BAND_COLORS } from "@/lib/dx";
import { useMemo } from "react";

interface Props {
  spots: Spot[];
}

/** Barres d'activité SSB par bande (le but : voir où ça bouge). */
export function BandStats({ spots }: Props) {
  const stats = useMemo(() => {
    const map: Record<string, { ssb: number; total: number }> = {};
    for (const b of TRACKED_BANDS) map[b] = { ssb: 0, total: 0 };
    for (const s of spots) {
      if (s.band && map[s.band]) {
        map[s.band].total++;
        if (s.family === "SSB") map[s.band].ssb++;
      }
    }
    const max = Math.max(1, ...Object.values(map).map((v) => v.total));
    return { map, max };
  }, [spots]);

  return (
    <div className="flex flex-col gap-2">
      {TRACKED_BANDS.map((b) => {
        const { ssb, total } = stats.map[b];
        const color = BAND_COLORS[b];
        const pct = (total / stats.max) * 100;
        const ssbPct = total ? (ssb / total) * 100 : 0;
        return (
          <div key={b} className="flex items-center gap-2">
            <span className="w-10 shrink-0 font-mono text-xs font-bold" style={{ color }}>
              {b}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted/50">
              <div
                className="absolute inset-y-0 left-0 rounded-sm opacity-30 transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-500"
                style={{ width: `${(ssbPct / 100) * pct}%`, background: color }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              <span className="text-phosphor font-bold">{ssb}</span>
              <span className="text-muted-foreground/50">/{total}</span>
            </span>
          </div>
        );
      })}
      <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
        barre pleine = SSB · barre claire = total
      </p>
    </div>
  );
}
