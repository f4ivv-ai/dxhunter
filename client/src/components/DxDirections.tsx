/**
 * DxDirections — Widget "Prévisions DX" pour la page Radar.
 * Affiche en temps réel les directions ouvertes (FT8 SNR >= -8 dB),
 * un compas avec l'azimut dominant, et les prédictions d'ouverture.
 */
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Compass, TrendingUp, Clock, Radio, ChevronDown, ChevronUp } from "lucide-react";

import { useMemo, useState, useEffect } from "react";

// Couleurs par continent
const CONT_COLORS: Record<string, string> = {
  EU: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  NA: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  SA: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  AF: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  AS: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  OC: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

const CONT_LABELS: Record<string, string> = {
  EU: "Europe",
  NA: "Am. Nord",
  SA: "Am. Sud",
  AF: "Afrique",
  AS: "Asie",
  OC: "Océanie",
};

// Couleurs de force par SNR
function snrColor(avgSnr: number): string {
  if (avgSnr >= -2) return "text-emerald-400"; // forte ouverture
  if (avgSnr >= -5) return "text-amber-400";   // modérée
  return "text-orange-400";                     // faible mais exploitable
}

function snrBg(avgSnr: number): string {
  if (avgSnr >= -2) return "bg-emerald-500/20 border-emerald-500/50";
  if (avgSnr >= -5) return "bg-amber-500/20 border-amber-500/50";
  return "bg-orange-500/20 border-orange-500/50";
}

// Mini compas SVG
function MiniCompass({ azimuth, size = 64 }: { azimuth: number; size?: number }) {
  const r = size / 2 - 4;
  const needleLen = r - 6;
  const rad = ((azimuth - 90) * Math.PI) / 180;
  const nx = size / 2 + Math.cos(rad) * needleLen;
  const ny = size / 2 + Math.sin(rad) * needleLen;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* Cercle */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-border" />
      {/* Graduations cardinales */}
      {[0, 90, 180, 270].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        const x1 = size / 2 + Math.cos(a) * (r - 3);
        const y1 = size / 2 + Math.sin(a) * (r - 3);
        const x2 = size / 2 + Math.cos(a) * r;
        const y2 = size / 2 + Math.sin(a) * r;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />;
      })}
      {/* Labels N/E/S/O */}
      <text x={size / 2} y={8} textAnchor="middle" className="fill-muted-foreground text-[8px] font-bold">N</text>
      <text x={size - 4} y={size / 2 + 3} textAnchor="middle" className="fill-muted-foreground text-[8px] font-bold">E</text>
      <text x={size / 2} y={size - 2} textAnchor="middle" className="fill-muted-foreground text-[8px] font-bold">S</text>
      <text x={4} y={size / 2 + 3} textAnchor="middle" className="fill-muted-foreground text-[8px] font-bold">O</text>
      {/* Aiguille */}
      <line
        x1={size / 2}
        y1={size / 2}
        x2={nx}
        y2={ny}
        stroke="oklch(0.85 0.18 85)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Point central */}
      <circle cx={size / 2} cy={size / 2} r="3" fill="oklch(0.85 0.18 85)" />
      {/* Degré */}
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="fill-foreground text-[9px] font-mono font-bold">
        {azimuth}°
      </text>
    </svg>
  );
}

function azToCardinal(az: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(az / 45) % 8];
}

export function DxDirections({ excludeEU = false }: { excludeEU?: boolean }) {
  const { data, isLoading } = trpc.spots.ft8Directions.useQuery(undefined, {
    refetchInterval: 30_000, // refresh toutes les 30s
    staleTime: 20_000,
  });

  const activeBands = useMemo(() => {
    if (!data) return [];
    let bands = data.bandDirections;

    return bands
      .map(b => ({
        ...b,
        openContinents: excludeEU ? b.openContinents.filter(c => c.continent !== "EU") : b.openContinents,
        totalSpots: excludeEU ? b.openContinents.filter(c => c.continent !== "EU").reduce((sum, c) => sum + c.spotCount, 0) : b.totalSpots,
      }))
      .filter((b) => b.totalSpots > 0);
  }, [data, excludeEU]);

  // Recalcul du dominant sans EU si filtré
  const filteredDominant = useMemo(() => {
    if (!data) return null;
    if (!excludeEU) return data.dominant;
    const allOpen = data.bandDirections.flatMap(b => b.openContinents).filter(c => c.continent !== "EU");
    if (allOpen.length === 0) return null;
    const contAgg: Record<string, { count: number; snrSum: number; az: number }> = {};
    for (const c of allOpen) {
      if (!contAgg[c.continent]) contAgg[c.continent] = { count: 0, snrSum: 0, az: c.azimuth };
      contAgg[c.continent].count += c.spotCount;
      contAgg[c.continent].snrSum += c.avgSnr * c.spotCount;
    }
    const best = Object.entries(contAgg).sort((a, b) => b[1].count - a[1].count)[0];
    if (!best) return null;
    return {
      continent: best[0],
      azimuth: best[1].az,
      cardinal: azToCardinal(best[1].az),
      totalSpots: best[1].count,
      avgSnr: Math.round(best[1].snrSum / best[1].count),
    };
  }, [data, excludeEU]);

  const filteredPredictions = useMemo(() => {
    if (!data) return [];
    return excludeEU ? data.predictions.filter((p: any) => p.continent !== "EU") : data.predictions;
  }, [data, excludeEU]);

  const filteredTotalSpots = useMemo(() => {
    if (!data) return 0;
    if (!excludeEU) return data.totalValidSpots;
    return data.bandDirections.flatMap(b => b.openContinents).filter(c => c.continent !== "EU").reduce((sum, c) => sum + c.spotCount, 0);
  }, [data, excludeEU]);

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-16 rounded bg-muted" />
      </div>
    );
  }

  const dominant = filteredDominant;
  const predictions = filteredPredictions;
  const totalValidSpots = filteredTotalSpots;

  return (
    <div className="space-y-3">
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {totalValidSpots} spots FT8 (SNR ≥ -8 dB) · 30 min{excludeEU ? " · hors EU" : ""}
        </span>
        <span className={cn(
          "rounded border px-1.5 py-0.5 font-mono text-[9px] font-black",
          data.receiverSource === "F4IVV"
            ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
            : "border-border bg-muted/30 text-muted-foreground",
        )} title="Source de réception retenue pour mesurer la propagation">
          RX {data.receiverSource}
        </span>
      </div>

      {/* Direction dominante + compas */}
      {dominant && (
        <div className={cn("flex items-center gap-3 rounded-lg border p-3", snrBg(dominant.avgSnr))}>
          <MiniCompass azimuth={dominant.azimuth} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("font-mono text-lg font-bold", snrColor(dominant.avgSnr))}>
                {dominant.azimuth}° {dominant.cardinal}
              </span>
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-bold">
                {CONT_LABELS[dominant.continent] ?? dominant.continent}
              </span>
              {(dominant as any).path && (
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                  (dominant as any).path === "LP" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-muted text-muted-foreground"
                )}>
                  {(dominant as any).path}
                </span>
              )}

            </div>
            <p className="text-[11px] text-muted-foreground">
              Direction dominante · {dominant.totalSpots} spots · SNR moy. {dominant.avgSnr} dB{(dominant as any).path === "LP" ? " · Long Path" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Grille bandes × directions */}
      {activeBands.length > 0 && (
        <div className="space-y-1.5">
          {activeBands.map((b) => (
            <div key={b.band} className="flex items-center gap-2">
              <span className="w-10 shrink-0 font-mono text-[11px] font-bold text-foreground">
                {b.band}
              </span>
              <div className="flex flex-wrap gap-1">
                {b.openContinents.map((c) => (
                  <span
                    key={c.continent}
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                      CONT_COLORS[c.continent] ?? "bg-muted text-muted-foreground border-border",
                      (c as any).path === "LP" && "ring-1 ring-amber-500/50",
                    )}
                    title={`${c.spotCount} spots, SNR moy. ${c.avgSnr} dB, max ${c.maxSnr} dB — ${c.azimuth}° ${c.cardinal} (${(c as any).path ?? "SP"})`}
                  >
                    {c.continent}
                    <span className="opacity-70">{c.azimuth}°</span>
                    {(c as any).path === "LP" && <span className="text-amber-400 font-bold">LP</span>}
                    <span className={cn("font-bold", snrColor(c.avgSnr))}>
                      {c.avgSnr > 0 ? "+" : ""}{c.avgSnr}
                    </span>

                  </span>
                ))}
              </div>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                {b.totalSpots}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Prédictions (prochaine heure) */}
      {predictions.length > 0 && (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/50 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" />
            Prochaine heure (prévision)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {predictions.slice(0, 6).map((p: any, i: number) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px]"
                title={`${p.probability}% de probabilité d'ouverture ${p.band} → ${p.continent} (${p.azimuth}° ${p.cardinal})`}
              >
                <span className="font-bold text-foreground">{p.band}</span>
                <span className="text-muted-foreground">→</span>
                <span className={cn("font-medium", CONT_COLORS[p.continent]?.split(" ")[1] ?? "text-foreground")}>
                  {p.continent}
                </span>
                <span className="font-mono text-muted-foreground">{p.probability}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Message si aucune donnée */}
      {totalValidSpots === 0 && (
        <p className="text-center text-[11px] text-muted-foreground italic">
          Aucun spot FT8 ≥ -8 dB dans les 30 dernières minutes. Propagation fermée ou PSK Reporter déconnecté.
        </p>
      )}
    </div>
  );
}

/**
 * Version repliable (même pattern que SelfMonitor).
 * Persiste l'état ouvert/fermé dans localStorage.
 */
export function DxDirectionsCollapsible() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("dxhunter-dxdirections-collapsed") === "true"; } catch { return false; }
  });
  const [dxOnly, setDxOnly] = useState(() => {
    try { return localStorage.getItem("dxhunter-dxdirections-dxonly") === "true"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem("dxhunter-dxdirections-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);
  useEffect(() => {
    try { localStorage.setItem("dxhunter-dxdirections-dxonly", String(dxOnly)); } catch {}
  }, [dxOnly]);

  const { data } = trpc.spots.ft8Directions.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // Résumé header (respecte le filtre DX only)
  const headerInfo = useMemo(() => {
    if (!data || !data.dominant) return null;
    if (!dxOnly) return data.dominant;
    // Recalcul sans EU
    const allOpen = data.bandDirections.flatMap(b => b.openContinents).filter(c => c.continent !== "EU");
    if (allOpen.length === 0) return null;
    const contAgg: Record<string, { count: number; az: number }> = {};
    for (const c of allOpen) {
      if (!contAgg[c.continent]) contAgg[c.continent] = { count: 0, az: c.azimuth };
      contAgg[c.continent].count += c.spotCount;
    }
    const best = Object.entries(contAgg).sort((a, b) => b[1].count - a[1].count)[0];
    if (!best) return null;
    const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    return {
      continent: best[0],
      azimuth: best[1].az,
      cardinal: dirs[Math.round(best[1].az / 45) % 8],
      totalSpots: allOpen.reduce((s, c) => s + c.spotCount, 0),
    };
  }, [data, dxOnly]);

  return (
    <>
      {/* Header repliable */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-primary/10"
      >
        <Compass className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
          Prévisions DX
        </span>
        {headerInfo && (
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
            {headerInfo.azimuth}° {headerInfo.cardinal} → {headerInfo.continent} · {headerInfo.totalSpots} spots
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {/* Contenu (masqué si replié) */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Toggle DX uniquement */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setDxOnly(v => !v)}
              className={cn(
                "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                dxOnly
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50",
              )}
            >
              DX uniquement
            </button>
            <span className="text-[10px] text-muted-foreground">
              {dxOnly ? "EU exclu — DX lointain seulement" : "Tous continents affichés"}
            </span>
          </div>
          <DxDirections excludeEU={dxOnly} />
        </div>
      )}
    </>
  );
}
