import { useMemo } from "react";
import { Spot, TRACKED_BANDS, BAND_COLORS } from "@/lib/dx";
import { cn } from "@/lib/utils";

interface Props {
  spots: Spot[];
}

/** Continents suivis, dans un ordre lisible, avec libellé court. */
const CONTINENTS: { code: string; label: string }[] = [
  { code: "EU", label: "EU" },
  { code: "AS", label: "AS" },
  { code: "NA", label: "NA" },
  { code: "SA", label: "SA" },
  { code: "AF", label: "AF" },
  { code: "OC", label: "OC" },
];

/**
 * Matrice "ouverture de bande par continent" : pour chaque bande HF suivie,
 * compte les spots reçus par continent du DX sur la fenêtre courante.
 * Une case colorée = activité détectée (bande probablement ouverte vers ce continent).
 */
export function BandOpenings({ spots }: Props) {
  const matrix = useMemo(() => {
    // map[band][continent] = count
    const m: Record<string, Record<string, number>> = {};
    for (const b of TRACKED_BANDS) {
      m[b] = {};
      for (const c of CONTINENTS) m[b][c.code] = 0;
    }
    let max = 0;
    for (const s of spots) {
      if (!s.band || !m[s.band]) continue;
      const cont = (s.dx_continent || "").toUpperCase();
      if (!(cont in m[s.band])) continue;
      m[s.band][cont] += 1;
      if (m[s.band][cont] > max) max = m[s.band][cont];
    }
    return { m, max };
  }, [spots]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <th className="px-1 py-1 text-left font-medium">Bd</th>
            {CONTINENTS.map((c) => (
              <th key={c.code} className="px-1 py-1 text-center font-medium" title={c.code}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TRACKED_BANDS.map((b) => {
            const color = BAND_COLORS[b];
            return (
              <tr key={b}>
                <td className="px-1 py-0.5">
                  <span
                    className="inline-block rounded px-1 py-0.5 font-mono text-[10px] font-bold"
                    style={{ color, background: `${color}1f` }}
                  >
                    {b}
                  </span>
                </td>
                {CONTINENTS.map((c) => {
                  const v = matrix.m[b][c.code];
                  // intensité relative (0..1) pour l'opacité de la case
                  const intensity = matrix.max > 0 ? v / matrix.max : 0;
                  return (
                    <td key={c.code} className="px-0.5 py-0.5 text-center">
                      <div
                        className={cn(
                          "mx-auto flex h-6 w-full min-w-[26px] items-center justify-center rounded font-mono text-[10px] font-bold tabular-nums transition-colors",
                          v === 0 && "bg-muted/20 text-muted-foreground/30"
                        )}
                        style={
                          v > 0
                            ? {
                                background: `${color}${Math.round(25 + intensity * 70)
                                  .toString(16)
                                  .padStart(2, "0")}`,
                                color: intensity > 0.5 ? "#0a0a0a" : color,
                              }
                            : undefined
                        }
                        title={`${b} → ${c.code} : ${v} spot(s)`}
                      >
                        {v > 0 ? v : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground/60">
        case colorée = activité détectée vers ce continent (fenêtre courante)
      </p>
    </div>
  );
}
