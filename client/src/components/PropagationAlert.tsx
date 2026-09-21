/**
 * DX Hunter — Bandeau d'alerte de propagation anormale.
 *
 * Affiche un bandeau clignotant quand une ouverture de propagation est détectée
 * (Sporadic E, TEP, Tropo, Meteor Scatter, Aurora).
 * Cliquable pour afficher les détails (stations, fréquences, direction).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { BAND_COLORS } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { Zap, Radio, ChevronDown, ChevronUp, Globe, Signal } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

/** Labels lisibles pour chaque type de propagation */
const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  Es: { label: "SPORADIC E", emoji: "⚡", color: "text-fuchsia-400" },
  TEP: { label: "TEP", emoji: "🌍", color: "text-emerald-400" },
  Tropo: { label: "TROPO", emoji: "🌫️", color: "text-sky-400" },
  MS: { label: "METEOR SCATTER", emoji: "☄️", color: "text-amber-400" },
  Aurora: { label: "AURORA", emoji: "🌌", color: "text-violet-400" },
  F2: { label: "F2 LAYER", emoji: "📡", color: "text-orange-400" },
  Backscatter: { label: "BACKSCATTER", emoji: "🔄", color: "text-cyan-400" },
  Unknown: { label: "PROPAGATION", emoji: "📻", color: "text-muted-foreground" },
};

const CONTINENT_LABELS: Record<string, Record<string, string>> = {
  AF: { fr: "Afrique", en: "Africa", de: "Afrika", pl: "Afryka", es: "África", it: "Africa" },
  AS: { fr: "Asie", en: "Asia", de: "Asien", pl: "Azja", es: "Asia", it: "Asia" },
  EU: { fr: "Europe", en: "Europe", de: "Europa", pl: "Europa", es: "Europa", it: "Europa" },
  NA: { fr: "Am. Nord", en: "N. America", de: "N-Amerika", pl: "Am. Pń.", es: "Am. Norte", it: "Am. Nord" },
  OC: { fr: "Océanie", en: "Oceania", de: "Ozeanien", pl: "Oceania", es: "Oceanía", it: "Oceania" },
  SA: { fr: "Am. Sud", en: "S. America", de: "S-Amerika", pl: "Am. Pd.", es: "Am. Sur", it: "Am. Sud" },
};

function formatAge(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${min % 60}`;
}

export function PropagationAlert() {
  const { data } = trpc.spots.propagationOpenings.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const { locale, t } = useI18n();

  const [expanded, setExpanded] = useState(false);

  if (!data || data.openings.length === 0) return null;

  const openings = data.openings;
  const topOpening = openings[0];
  const typeInfo = TYPE_LABELS[topOpening.type] || TYPE_LABELS.Unknown;

  return (
    <div className="border-b border-border">
      {/* Bandeau principal — toujours visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left transition-all",
          "bg-gradient-to-r from-fuchsia-950/60 via-background to-fuchsia-950/60",
          "hover:from-fuchsia-950/80 hover:to-fuchsia-950/80",
          "animate-pulse-slow"
        )}
      >
        <Zap className="h-4 w-4 text-fuchsia-400 animate-bounce" />
        <span className={cn("font-mono text-xs font-black tracking-wider", typeInfo.color)}>
          {typeInfo.emoji} {typeInfo.label}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {topOpening.band}
        </span>
        <span
          className="h-2.5 w-2.5 rounded-full animate-ping"
          style={{ background: BAND_COLORS[topOpening.band] || "#ff44ff" }}
        />
        <span className="text-xs text-foreground/80 truncate">
          {topOpening.directions.map(d => CONTINENT_LABELS[d]?.[locale] || d).join(", ")}
          {" · "}
          {topOpening.spotCount} spots
          {topOpening.maxDistanceKm > 0 && ` · ${Math.round(topOpening.maxDistanceKm)} km`}
        </span>
        {openings.length > 1 && (
          <span className="ml-1 rounded bg-fuchsia-500/20 px-1.5 py-0.5 font-mono text-[10px] text-fuchsia-300">
            +{openings.length - 1}
          </span>
        )}
        <span className="ml-auto">
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </button>

      {/* Panneau détail — déplié au clic */}
      {expanded && (
        <div className="border-t border-border/50 bg-card/50 px-3 py-3 space-y-3">
          {openings.map((op) => {
            const info = TYPE_LABELS[op.type] || TYPE_LABELS.Unknown;
            const age = Date.now() - op.startedAt;
            return (
              <div
                key={op.id}
                className="rounded border border-border/60 bg-background/50 p-3 space-y-2"
              >
                {/* En-tête ouverture */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("font-mono text-xs font-bold", info.color)}>
                    {info.emoji} {info.label}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold text-background"
                    style={{ background: BAND_COLORS[op.band] || "#888" }}
                  >
                    {op.band}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatAge(age)}
                  </span>
                  <span className={cn(
                    "ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                    op.confidence === "high" ? "bg-green-500/20 text-green-400" :
                    op.confidence === "medium" ? "bg-amber-500/20 text-amber-400" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {op.confidence === "high" ? t("high") : op.confidence === "medium" ? t("medium") : t("low")}
                  </span>
                </div>

                {/* Métriques */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Signal className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground/80">{op.spotCount} spots</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground/80">
                      {op.directions.map(d => CONTINENT_LABELS[d]?.[locale] || d).join(", ") || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground/80">
                      {op.maxDistanceKm > 0 ? `${Math.round(op.maxDistanceKm)} km max` : "—"}
                    </span>
                  </div>
                  {op.avgSnr !== null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-mono text-[10px]">SNR</span>
                      <span className="text-foreground/80 font-mono">{op.avgSnr} dB</span>
                    </div>
                  )}
                </div>

                {/* Stations entendues */}
                {op.stations.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("stations")} ({op.stations.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {op.stations.slice(0, 12).map((call) => (
                        <span
                          key={call}
                          className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary"
                        >
                          {call}
                        </span>
                      ))}
                      {op.stations.length > 12 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{op.stations.length - 12}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Commentaires bruts */}
                {op.comments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Commentaires
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {op.comments.slice(0, 3).map((c, i) => (
                        <span key={i} className="text-[11px] text-foreground/60 italic truncate">
                          "{c}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
