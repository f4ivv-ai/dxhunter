/**
 * PlanTicker — Bandeau défilant Plan 24h heure par heure.
 * Affiche les recommandations de propagation pour les prochaines heures
 * sous forme de ticker animé dans le header principal.
 *
 * Modes :
 * - Par bande : recommandations spécifiques à une bande sélectionnée
 * - Général : meilleure bande + direction à chaque heure
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getTickerSlots, ContestBand, ALL_CONTEST_BANDS, QthCoords } from "@/lib/propagationMultiBand";
import { SolarInputs } from "@/lib/propagation";
import { cn } from "@/lib/utils";
import { Radio, ChevronDown, ChevronUp } from "lucide-react";

interface PlanTickerProps {
  solar: SolarInputs;
  qth?: QthCoords;
}

export function PlanTicker({ solar, qth }: PlanTickerProps) {
  const [band, setBand] = useState<ContestBand | "general">("general");
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Recalcul toutes les 60s
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const slots = useMemo(
    () => getTickerSlots(band, solar, expanded ? 12 : 6, qth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [band, solar.kp, solar.sfi, solar.blackout, tick, expanded, qth]
  );

  // Animation de défilement horizontal automatique (quand non expanded)
  useEffect(() => {
    if (expanded || !scrollRef.current) return;
    const el = scrollRef.current;
    let animId: number;
    let pos = 0;
    const speed = 0.4; // px par frame

    const animate = () => {
      pos += speed;
      if (pos >= el.scrollWidth - el.clientWidth) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [expanded, slots]);

  return (
    <div className="relative">
      {/* Sélecteur de bande */}
      <div className="flex items-center gap-1 px-2 py-1">
        <Radio className="h-3 w-3 text-cyan-400 shrink-0" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-cyan-400 shrink-0">
          Plan 24h
        </span>
        <div className="flex items-center gap-0.5 ml-1">
          <BandBtn
            active={band === "general"}
            onClick={() => setBand("general")}
            label="Général"
          />
          {ALL_CONTEST_BANDS.map((b) => (
            <BandBtn
              key={b}
              active={band === b}
              onClick={() => setBand(b)}
              label={b}
            />
          ))}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          title={expanded ? "Réduire" : "Voir plus"}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Bandeau défilant ou liste étendue */}
      {expanded ? (
        <div className="px-2 pb-1.5 space-y-0.5 max-h-[200px] overflow-y-auto">
          {slots.map((slot, i) => (
            <TickerItem key={i} slot={slot} />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-hidden px-2 pb-1.5 whitespace-nowrap"
          onMouseEnter={() => {
            if (scrollRef.current) scrollRef.current.style.animationPlayState = "paused";
          }}
          onMouseLeave={() => {
            if (scrollRef.current) scrollRef.current.style.animationPlayState = "running";
          }}
        >
          {slots.map((slot, i) => (
            <TickerItem key={i} slot={slot} inline />
          ))}
        </div>
      )}
    </div>
  );
}

function TickerItem({ slot, inline }: { slot: { hourUTC: number; text: string; isNow: boolean }; inline?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] shrink-0 transition-colors",
        slot.isNow
          ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold"
          : "bg-card/60 border border-border/40 text-muted-foreground",
        inline && "min-w-max"
      )}
    >
      <span className={cn(
        "font-bold tabular-nums",
        slot.isNow ? "text-cyan-300" : "text-foreground/80"
      )}>
        {String(slot.hourUTC).padStart(2, "0")}h
      </span>
      <span className="text-[9px]">→</span>
      <span className={cn(
        "truncate",
        slot.isNow ? "text-cyan-200" : "text-foreground/70"
      )}>
        {slot.text.replace(/^\d{2}h → /, "")}
      </span>
    </div>
  );
}

function BandBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase transition-all active:scale-[0.95]",
        active
          ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50"
          : "text-muted-foreground/70 hover:text-foreground/80 hover:bg-card/60"
      )}
    >
      {label}
    </button>
  );
}
