import { Spot, BAND_COLORS, fmtFreq, ageLabel, displayMode } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { Star, Radio, Target, Headphones, Navigation, Zap, Compass, X } from "lucide-react";
import { bearingDistance } from "@/lib/propagation";
import { useMemo } from "react";

const FAMILY_STYLE: Record<string, { label: string; cls: string }> = {
  SSB: { label: "SSB", cls: "text-phosphor border-phosphor/40 bg-phosphor/10" },
  CW: { label: "CW", cls: "text-steel border-steel/40 bg-steel/10" },
  FT8: { label: "FT8", cls: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10" },
  DIGI: { label: "DIGI", cls: "text-muted-foreground border-border bg-muted/40" },
  AUTRE: { label: "—", cls: "text-muted-foreground border-border bg-muted/40" },
};

interface Props {
  spot: Spot;
  isNew: boolean;
  isHovered: boolean;
  isExpanded: boolean;
  isWorked: boolean;
  isOob: boolean;
  userLat?: number | null;
  userLon?: number | null;
  onHover: (id: string | null) => void;
  onToggle: () => void;
  onMarkWorked: (dxCall: string, band?: string) => void;
  onMarkOob: (dxCall: string, freqKhz: number) => void;
  onQsy?: (freqKhz: number, mode?: string) => void;
  catConnected?: boolean;
  onRotor?: (bearing: number) => void;

  isPinned?: boolean;
  onUnpin?: () => void;
}

export function shouldShowQsyButton(onQsy?: Props["onQsy"]): boolean {
  return typeof onQsy === "function";
}

export function SpotRow({ spot, isNew, isHovered, isExpanded, isWorked, isOob, userLat, userLon, onHover, onToggle, onMarkWorked, onMarkOob, onQsy, catConnected, onRotor, isPinned, onUnpin }: Props) {
  const fam = FAMILY_STYLE[spot.family] ?? FAMILY_STYLE.AUTRE;
  const bandColor = BAND_COLORS[spot.band || ""] || "#ffb000";

  // Compute distance & azimuth from user QTH to DX station
  const distAz = useMemo(() => {
    if (userLat == null || userLon == null) return null;
    if (spot.dx_latitude == null || spot.dx_longitude == null) return null;
    const { bearing, distance } = bearingDistance(userLat, userLon, spot.dx_latitude, spot.dx_longitude);
    return { bearing: Math.round(bearing), distance: Math.round(distance) };
  }, [userLat, userLon, spot.dx_latitude, spot.dx_longitude]);

  return (
    <tr
      onClick={onToggle}
      onMouseEnter={() => onHover(spot.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "border-b border-border/50 transition-colors cursor-pointer group",
        isNew && "spot-in flash-new",
        isExpanded ? "bg-primary/15 border-primary/30" : isHovered ? "bg-primary/10" : "hover:bg-accent/40",
        spot.isRare && !isExpanded && "bg-destructive/5",
        spot.isTarget && !isExpanded && "bg-amber-400/10 ring-1 ring-inset ring-amber-400/30",
        (isWorked || isOob) && "opacity-40"
      )}
      title={isPinned ? "QSY actif — cliquer pour voir les WebSDR" : "Cliquer pour voir les WebSDR proches et QRZ.com"}
      style={isPinned ? { boxShadow: "inset 0 0 0 2px rgba(251,191,36,0.6)" } : undefined}
    >
      {/* heure */}
      <td className="px-1.5 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap align-middle">
        <div className="flex flex-col items-start gap-0.5">
          {isPinned && (
            <div className="flex items-center gap-0.5">
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 border border-amber-400/50 px-1 py-0.5 font-mono text-[8px] font-bold text-amber-300 uppercase tracking-wider animate-pulse">
                📡 QSY
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onUnpin?.(); }}
                className="inline-flex items-center justify-center rounded bg-muted/60 border border-border/50 p-0.5 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                title="Libérer ce spot"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
          {ageLabel(spot.time)}
        </div>
      </td>
      {/* bande + boutons FAIT / HB */}
      <td className="px-1.5 py-1 whitespace-nowrap align-middle">
        <div className="flex items-center gap-0.5">
          <span
            className="inline-block rounded px-1 py-0.5 font-mono text-[10px] font-bold"
            style={{ color: bandColor, background: `${bandColor}1f`, border: `1px solid ${bandColor}55` }}
          >
            {spot.band}
          </span>

        </div>
      </td>
      {/* fréquence + QSY — masqué sur mobile (< sm) */}
      <td className="hidden sm:table-cell px-1.5 py-1 align-middle whitespace-nowrap">
        {/* Fréquence sur une ligne, QSY/ROT sur la ligne suivante */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-xs font-semibold text-foreground tabular-nums">{fmtFreq(spot.freqKhz)}</span>
          {shouldShowQsyButton(onQsy) || (onRotor && distAz) ? (
            <div className="inline-flex items-center rounded border border-border/40 overflow-hidden">
              {shouldShowQsyButton(onQsy) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onQsy!(spot.freqKhz, spot.mode || undefined); }}
                  className={cn(
                    "inline-flex items-center gap-0.5 px-1 py-0.5 font-mono text-[8px] font-bold uppercase transition-all active:scale-[0.95]",
                    catConnected ? "bg-primary/15 text-primary hover:bg-primary/30" : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
                    onRotor && distAz ? "border-r border-border/50" : ""
                  )}
                  title={catConnected ? `QSY → ${fmtFreq(spot.freqKhz)} ${spot.mode || ""}` : "QSY indisponible — démarrer le bridge CAT"}
                >
                  <Zap className="h-2 w-2" />
                  qsy
                </button>
              )}
              {onRotor && distAz && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRotor(distAz.bearing); }}
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 font-mono text-[8px] font-bold uppercase transition-all active:scale-[0.95] bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/25"
                  title={`Rotor → ${distAz.bearing}° (${spot.dx_country || spot.dx_call})`}
                >
                  <Compass className="h-2 w-2" />
                  {distAz.bearing}°
                </button>
              )}
            </div>
          ) : null}
        </div>
      </td>
      {/* mode — masqué en mobile (replié sous le DX) */}
      <td className="hidden px-1.5 py-1 whitespace-nowrap align-middle md:table-cell">
        <span className={cn("inline-block rounded border px-1 py-0.5 font-mono text-[9px] font-bold", fam.cls)}>
          {spot.family === "SSB" ? displayMode(spot.mode, spot.freqKhz) : (spot.mode || fam.label)}
        </span>
      </td>
      {/* indicatif DX (+ infos repliées en mobile) */}
      <td className="px-1.5 py-1 align-middle">
        <div className="flex items-center gap-1.5">
          {spot.isTarget && <Target className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
          {spot.isRare && <Star className="h-3.5 w-3.5 shrink-0 fill-destructive text-destructive" />}
          <span
            className={cn(
              "font-mono text-xs font-bold tracking-wide",
              isWorked ? "line-through text-muted-foreground" : isPinned ? "text-amber-200" : spot.isTarget ? "text-amber-300" : spot.isRare ? "text-destructive" : "text-primary"
            )}
          >
            {spot.dx_call}
          </span>

          {shouldShowQsyButton(onQsy) && (
            <button
              onClick={(e) => { e.stopPropagation(); onQsy!(spot.freqKhz, spot.mode || undefined); }}
              className={cn(
                "sm:hidden inline-flex items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-[8px] font-bold uppercase active:scale-[0.95]",
                catConnected ? "border-primary/40 bg-primary/15 text-primary" : "border-amber-500/40 bg-amber-500/10 text-amber-400",
              )}
              title={catConnected ? `QSY → ${fmtFreq(spot.freqKhz)}` : "Démarrer le bridge CAT"}
            >
              <Zap className="h-2.5 w-2.5" /> qsy
            </button>
          )}

          <Headphones className={cn(
            "h-3 w-3 shrink-0 transition-opacity",
            isExpanded ? "text-primary opacity-100" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
          )} />
        </div>
        {/* Repli mobile : mode + pays + spotter sous l'indicatif */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[9px] text-muted-foreground sm:hidden">
          <span className={cn("rounded border px-0.5 font-mono font-bold", fam.cls)}>
            {spot.family === "SSB" ? displayMode(spot.mode, spot.freqKhz) : (spot.mode || fam.label)}
          </span>
          <span className="inline-flex items-center gap-0.5 truncate">
            <span className="leading-none">{spot.dx_flag || "🏳️"}</span>
            <span className="truncate text-foreground/75">{spot.dx_country || "?"}</span>
          </span>
          <span className="font-mono text-foreground/50">{spot.de_call}</span>
        </div>
      </td>
      {/* pays — tablet+ */}
      <td className="hidden sm:table-cell px-1.5 py-1 align-middle">
        <div className="flex items-center gap-1 truncate">
          <span className="text-xs leading-none shrink-0">{spot.dx_flag || "🏳️"}</span>
          <span className="truncate text-[11px] text-foreground/85">{spot.dx_country || "?"}</span>
        </div>
      </td>
      {/* spotter + commentaire — desktop */}
      <td className="hidden px-1.5 py-1 align-middle lg:table-cell">
        <div className="truncate text-[10px] text-muted-foreground">
          <span className="font-mono text-foreground/60 text-[10px]">{spot.de_call}</span>
          {spot.comment ? <span className="ml-1 italic opacity-70">"{spot.comment}"</span> : null}
        </div>
      </td>
      {/* distance/azimut */}
      <td className="hidden px-1.5 py-1 whitespace-nowrap text-right align-middle lg:table-cell">
        {distAz ? (
          <div className="flex flex-col items-end gap-0">
            <span className="font-mono text-[9px] text-foreground/70 tabular-nums">{distAz.distance.toLocaleString()} km</span>
            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-primary/80">
              <Navigation className="h-2.5 w-2.5" style={{ transform: `rotate(${distAz.bearing}deg)` }} />
              {distAz.bearing}°
            </span>
          </div>
        ) : (
          <span className="font-mono text-[9px] text-muted-foreground/40">—</span>
        )}
      </td>
      {/* source — desktop */}
      <td className="hidden px-1.5 py-1 whitespace-nowrap text-right align-middle md:table-cell">
        <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground/70">
          <Radio className="h-2.5 w-2.5" />
          {spot.source}
        </span>
      </td>
    </tr>
  );
}
