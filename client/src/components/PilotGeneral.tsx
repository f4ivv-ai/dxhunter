/**
 * PilotGeneral — Vue d'ensemble pilotage toutes bandes.
 * Affiche pour chaque bande le score d'ouverture actuel, la meilleure direction,
 * et une recommandation d'action.
 * 
 * V7.12 : chaque carte de bande est cliquable → affiche les prévisions heure par heure
 * pour cette bande (direction, azimut, score) pour les 12 prochaines heures.
 */
import { useMemo, useState } from "react";
import { buildGeneralTimeline, buildBandTimeline, ALL_CONTEST_BANDS, ContestBand, BandTimelineSlot, QthCoords } from "@/lib/propagationMultiBand";
import { SolarInputs } from "@/lib/propagation";
import { SolarVerdict } from "@/components/SolarVerdict";
import { cn } from "@/lib/utils";
import { Spot } from "@/lib/dx";
import { SpaceWeather } from "@/hooks/useSpaceWeather";
import { ArrowLeft, Compass } from "lucide-react";

interface PilotGeneralProps {
  solar: SolarInputs;
  spots: Spot[];
  sw: SpaceWeather;
  qth?: QthCoords;
}

export function PilotGeneral({ solar, spots, sw, qth }: PilotGeneralProps) {
  const nowHour = new Date().getUTCHours();
  const [selectedBand, setSelectedBand] = useState<ContestBand | null>(null);

  const timeline = useMemo(
    () => buildGeneralTimeline(solar, nowHour, qth),
    [solar, nowHour, qth]
  );

  const bandTimeline = useMemo(
    () => selectedBand ? buildBandTimeline(selectedBand, solar, nowHour, qth) : [],
    [selectedBand, solar, nowHour, qth]
  );

  const currentSlot = timeline[0];

  // Compte de spots par bande
  const spotsByBand = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of ALL_CONTEST_BANDS) counts[b] = 0;
    for (const s of spots) {
      if (s.band && counts[s.band] !== undefined) counts[s.band]++;
    }
    return counts;
  }, [spots]);

  // Vue détaillée d'une bande sélectionnée
  if (selectedBand) {
    return (
      <div className="space-y-4">
        <div className="mb-3"><SolarVerdict sw={sw} /></div>

        {/* Bouton retour + titre */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedBand(null)}
            className="flex items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-primary/50 hover:text-primary active:scale-[0.97]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </button>
          <h2 className={cn("font-mono text-lg font-extrabold", bandColorClass(selectedBand))}>
            {selectedBand}
          </h2>
          <span className="text-xs text-muted-foreground">— Prévisions heure par heure</span>
        </div>

        {/* Résumé actuel */}
        {bandTimeline[0] && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold text-primary">Maintenant</span>
            </div>
            <div className="font-mono text-sm font-bold text-foreground">{bandTimeline[0].headline}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Score global : <span className="font-bold text-foreground">{bandTimeline[0].bandScore}/100</span>
            </div>
            {bandTimeline[0].zones.length > 0 && (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {bandTimeline[0].zones.map((z, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-border/60 bg-card/60 px-2.5 py-1.5">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0",
                      z.score >= 65 ? "bg-phosphor/70" : z.score >= 45 ? "bg-primary/70" : z.score >= 25 ? "bg-amber-400/60" : "bg-muted/40"
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[10px] font-bold text-foreground/90">{z.label}</div>
                      <div className="text-[9px] text-muted-foreground">
                        Cap {z.az}° {z.cardinal} {z.path} · Score {z.score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline heure par heure (12 prochaines heures) */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground border-b border-border pb-2">
            {selectedBand} — Prochaines 12 heures
          </h3>
          <div className="space-y-1">
            {bandTimeline.slice(0, 12).map((slot, i) => (
              <BandHourRow key={i} slot={slot} isNow={i === 0} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Vue générale (toutes les bandes)
  return (
    <div className="space-y-4">
      <div className="mb-3"><SolarVerdict sw={sw} /></div>

      <p className="text-[11px] text-muted-foreground mb-2">
        Cliquez sur une bande pour voir les prévisions détaillées heure par heure.
      </p>

      {/* Grille des bandes — cliquables */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {currentSlot?.bands.map((b) => (
          <BandCard
            key={b.band}
            band={b.band}
            score={b.score}
            headline={b.headline}
            topZone={b.topZone}
            topAz={b.topAz}
            topPath={b.topPath}
            spotCount={spotsByBand[b.band] ?? 0}
            isBest={b.band === currentSlot.bestBand}
            onClick={() => setSelectedBand(b.band)}
          />
        ))}
      </div>

      {/* Timeline des 6 prochaines heures */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-foreground border-b border-border pb-2">
          Prochaines 6 heures — Meilleure bande par créneau
        </h3>
        <div className="space-y-1">
          {timeline.slice(0, 6).map((slot, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded border px-3 py-2",
                i === 0 ? "border-cyan-500/40 bg-cyan-500/10" : "border-border/60 bg-card/40"
              )}
            >
              <div className="w-10 shrink-0 font-mono text-xs font-bold text-foreground">
                {String(slot.hourUTC).padStart(2, "0")}h
              </div>
              <div className={cn(
                "shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                bandColorBg(slot.bestBand)
              )}>
                {slot.bestBand}
              </div>
              <div className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                {slot.headline}
              </div>
              <div className="shrink-0 flex gap-1">
                {slot.bands.slice(0, 3).map((b) => (
                  <span
                    key={b.band}
                    className="font-mono text-[8px] text-muted-foreground"
                    title={`${b.band}: ${b.score}`}
                  >
                    {b.band}:{b.score}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Ligne heure par heure pour une bande */
function BandHourRow({ slot, isNow }: { slot: BandTimelineSlot; isNow: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded border px-3 py-2 transition-colors",
      isNow ? "border-primary bg-primary/10" : "border-border/60 bg-card/40"
    )}>
      <div className="w-12 shrink-0 text-center">
        <div className={cn("font-mono text-xs font-bold", isNow ? "text-primary" : "text-foreground")}>
          {String(slot.hourUTC).padStart(2, "0")}h
        </div>
        <div className="text-[8px] uppercase text-muted-foreground">UTC</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-foreground/90">{slot.headline}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {slot.zones.map((z, j) => (
            <span
              key={j}
              className="flex items-center gap-1 rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
              title={`${z.label} — cap ${z.az}° ${z.cardinal} (${z.path})`}
            >
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                z.score >= 65 ? "bg-phosphor/70" : z.score >= 45 ? "bg-primary/70" : z.score >= 25 ? "bg-amber-400/60" : "bg-muted/40"
              )} />
              {z.label.split("(")[0].trim()} {z.az}° {z.path}
            </span>
          ))}
        </div>
      </div>
      <div className="shrink-0 w-10 text-right">
        <div className={cn(
          "font-mono text-sm font-bold",
          slot.bandScore >= 65 ? "text-phosphor" : slot.bandScore >= 40 ? "text-primary" : slot.bandScore >= 20 ? "text-amber-400" : "text-muted-foreground"
        )}>
          {slot.bandScore}
        </div>
      </div>
    </div>
  );
}

function BandCard({
  band,
  score,
  headline,
  topZone,
  topAz,
  topPath,
  spotCount,
  isBest,
  onClick,
}: {
  band: ContestBand;
  score: number;
  headline: string;
  topZone: string;
  topAz: number;
  topPath: "SP" | "LP";
  spotCount: number;
  isBest: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 transition-all text-left w-full cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.97]",
        isBest
          ? "border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn("font-mono text-sm font-bold", bandColorClass(band))}>{band}</span>
        {isBest && (
          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-cyan-300">
            Meilleure
          </span>
        )}
        <span className={cn(
          "font-mono text-lg font-extrabold",
          score >= 65 ? "text-phosphor" : score >= 40 ? "text-primary" : score >= 20 ? "text-amber-400" : "text-muted-foreground"
        )}>
          {score}
        </span>
      </div>
      <div className="text-[11px] font-medium text-foreground/80 truncate mb-1">{headline}</div>
      {topAz > 0 && (
        <div className="text-[10px] text-muted-foreground">
          → {topZone} · cap {topAz}° {topPath}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-border/50 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              score >= 65 ? "bg-phosphor/70" : score >= 40 ? "bg-primary/70" : score >= 20 ? "bg-amber-400/60" : "bg-muted/40"
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">{spotCount} spots</span>
      </div>
      <div className="mt-1.5 text-center text-[9px] text-primary/60 font-medium">
        Cliquer pour détail →
      </div>
    </button>
  );
}

function bandColorClass(band: ContestBand): string {
  const colors: Record<ContestBand, string> = {
    "160m": "text-violet-400",
    "80m": "text-blue-400",
    "40m": "text-cyan-400",
    "20m": "text-yellow-400",
    "15m": "text-orange-400",
    "10m": "text-rose-400",
  };
  return colors[band] ?? "text-foreground";
}

function bandColorBg(band: ContestBand): string {
  const colors: Record<ContestBand, string> = {
    "160m": "bg-violet-500/20 text-violet-300",
    "80m": "bg-blue-500/20 text-blue-300",
    "40m": "bg-cyan-500/20 text-cyan-300",
    "20m": "bg-yellow-500/20 text-yellow-300",
    "15m": "bg-orange-500/20 text-orange-300",
    "10m": "bg-rose-500/20 text-rose-300",
  };
  return colors[band] ?? "bg-muted text-muted-foreground";
}
