/**
 * Page "Prévisions 7 jours" — propagation 40 m depuis JN25PG.
 * Croise les prévisions NOAA (27-day outlook, Kp forecast 3h, probabilités éruptions)
 * pour afficher un score par zone et par jour avec code couleur.
 */
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { DEFAULT_QTH_LOCATOR } from "@/lib/propagation";
import {
  ArrowLeft,
  Calendar,
  Sun,
  Zap,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  Map,
} from "lucide-react";
import { locatorToLatLon } from "@/lib/propagation";
import { ForecastMap } from "@/components/ForecastMap";
import { PremiumGate } from "@/components/PremiumGate";

const SLOT_LABELS = ["00–06", "06–12", "12–18", "18–24"];

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 55) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  if (score >= 25) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500/20 border-emerald-500/40";
  if (score >= 55) return "bg-green-500/20 border-green-500/40";
  if (score >= 40) return "bg-yellow-500/20 border-yellow-500/40";
  if (score >= 25) return "bg-orange-500/20 border-orange-500/40";
  return "bg-red-500/20 border-red-500/40";
}

function verdictColor(verdict: string): string {
  if (verdict === "Excellent") return "text-emerald-400";
  if (verdict === "Bon") return "text-green-400";
  if (verdict === "Moyen") return "text-yellow-400";
  if (verdict === "Dégradé") return "text-orange-400";
  return "text-red-400";
}

function riskBadge(risk: string) {
  if (risk === "high")
    return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400 uppercase">Risque élevé</span>;
  if (risk === "medium")
    return <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 uppercase">Risque moyen</span>;
  return <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">Risque faible</span>;
}

function formatDate(dateStr: string): { day: string; weekday: string; full: string } {
  const d = new Date(dateStr + "T12:00:00Z");
  const weekdays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  return {
    day: `${d.getUTCDate()} ${months[d.getUTCMonth()]}`,
    weekday: weekdays[d.getUTCDay()],
    full: `${weekdays[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  };
}

export default function Forecast() {
  const { user } = useAuth();
  const userLocator = user?.locator || DEFAULT_QTH_LOCATOR;
  const { data, isLoading, error } = trpc.spots.forecast7d.useQuery(
    { locator: userLocator },
    {
      staleTime: 5 * 60 * 1000, // cache 5 min
      refetchInterval: 10 * 60 * 1000, // refresh toutes les 10 min
    },
  );

  return (
    <PremiumGate mode="block" featureName="Prévisions 7 jours">
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-[oklch(0.16_0.009_250)]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-primary/50 hover:text-primary active:scale-[0.97]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Radar</span>
          </Link>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-400" />
            <div>
              <h1 className="font-mono text-base font-extrabold tracking-tight text-foreground leading-none">
                PRÉVISIONS <span className="text-cyan-400">7 JOURS</span>
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Propagation 40 m depuis {userLocator} · Sources NOAA croisées
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/pilot"
              className="flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary/20 active:scale-[0.97]"
            >
              Pilotage
            </Link>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <span className="ml-3 text-muted-foreground">Chargement des prévisions NOAA + observations FT8…</span>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-red-400">
            <AlertTriangle className="mb-1 inline h-4 w-4" /> Erreur de chargement des prévisions. Réessayez dans quelques instants.
          </div>
        )}

        {data && (
          <>
            {/* Résumé timeline */}
            <section className="mb-6">
              <h2 className="mb-3 font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Vue d'ensemble — 7 prochains jours
              </h2>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {data.days.map((day) => {
                  const { day: dayLabel, weekday } = formatDate(day.date);
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "rounded-lg border p-2 sm:p-3 text-center transition-all",
                        scoreBg(day.globalScore),
                      )}
                    >
                      <div className="text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">
                        {weekday}
                      </div>
                      <div className="text-[11px] text-foreground/80 sm:text-sm">{dayLabel}</div>
                      <div className={cn("mt-1 font-mono text-lg font-extrabold sm:text-2xl", scoreColor(day.globalScore))}>
                        {day.globalScore}
                      </div>
                      <div className={cn("text-[10px] font-bold sm:text-xs", verdictColor(day.verdict))}>
                        {day.verdict}
                      </div>
                      <div className="mt-1 hidden font-mono text-[8px] text-muted-foreground sm:block">
                        FT8 {day.ft8Confidence}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Légende */}
            <div className="mb-6 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500" /> 70+ Excellent</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-green-500" /> 55-69 Bon</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-yellow-500" /> 40-54 Moyen</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-orange-500" /> 25-39 Dégradé</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-red-500" /> &lt;25 Mauvais</span>
              <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-cyan-400">Modèle NOAA + FT8 réel</span>
            </div>

            {/* Carte de propagation — aujourd'hui */}
            {data.days[0] && (() => {
              const coords = locatorToLatLon(userLocator);
              if (!coords) return null;
              return (
                <section className="mb-6">
                  <h2 className="mb-3 flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    <Map className="h-4 w-4 text-cyan-400" />
                    Carte de propagation — Aujourd'hui
                  </h2>
                  <ForecastMap
                    zones={data.days[0].zones}
                    userLat={coords.lat}
                    userLon={coords.lon}
                  />
                </section>
              );
            })()}

            {/* Détail jour par jour */}
            <section className="space-y-4">
              {data.days.map((day) => {
                const { full } = formatDate(day.date);
                const sortedZones = [...day.zones].sort((a, b) => b.avg - a.avg);
                return (
                  <details key={day.date} className="group rounded-lg border border-border bg-card/50">
                    <summary className="cursor-pointer px-3 py-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("font-mono text-xl font-extrabold", scoreColor(day.globalScore))}>
                          {day.globalScore}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-foreground">{full}</span>
                            <span className={cn("text-xs font-bold", verdictColor(day.verdict))}>
                              {day.verdict}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Sun className="h-3 w-3 text-yellow-400" /> SFI {day.sfi}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Zap className="h-3 w-3 text-red-400" /> Kp {day.kpMax}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Shield className="h-3 w-3 text-cyan-400" /> A={day.aIndex}
                            </span>
                            <span className="flex items-center gap-0.5 text-cyan-400">
                              Confiance FT8 {day.ft8Confidence}%
                            </span>
                            {day.flareProb.m > 0 && (
                              <span className="flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3 text-orange-400" /> M:{day.flareProb.m}%{day.flareProb.x > 0 ? ` X:${day.flareProb.x}%` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 text-muted-foreground text-xs">
                          {day.globalScore > (data.days[0]?.globalScore ?? 0) ? (
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-orange-400" />
                          )}
                        </div>
                      </div>
                    </summary>

                    {/* Tableau des zones */}
                    <div className="border-t border-border px-3 py-3 sm:px-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              <th className="py-1 text-left font-medium">Zone</th>
                              {SLOT_LABELS.map((s) => (
                                <th key={s} className="py-1 text-center font-medium">{s}</th>
                              ))}
                              <th className="py-1 text-center font-medium">Moy.</th>
                              <th className="py-1 text-center font-medium">Pic</th>
                              <th className="py-1 text-center font-medium">Conf. FT8</th>
                              <th className="py-1 text-right font-medium">Risque</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedZones.map((zone) => (
                              <tr key={zone.zoneId} className="border-t border-border/50">
                                <td className="py-1.5 pr-2 font-medium text-foreground/90 whitespace-nowrap">
                                  {zone.label}
                                </td>
                                {zone.scores.map((s, i) => (
                                  <td key={i} className="py-1.5 text-center">
                                    <span className={cn("font-mono font-bold", scoreColor(s))}>{s}</span>
                                  </td>
                                ))}
                                <td className="py-1.5 text-center">
                                  <span className={cn("font-mono font-bold", scoreColor(zone.avg))}>{zone.avg}</span>
                                </td>
                                <td className="py-1.5 text-center">
                                  <span className={cn("font-mono font-bold", scoreColor(zone.peak))}>{zone.peak}</span>
                                  <span className="ml-0.5 text-[9px] text-muted-foreground">
                                    ({SLOT_LABELS[zone.peakSlot]})
                                  </span>
                                </td>
                                <td className="py-1.5 text-center font-mono text-[10px] text-cyan-400">{zone.ft8Confidence}%</td>
                                <td className="py-1.5 text-right">{riskBadge(zone.risk)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                );
              })}
            </section>

            {/* Footer sources */}
            <footer className="mt-6 border-t border-border pt-3 text-[10px] text-muted-foreground">
              <p>
                Sources : NOAA SWPC 27-Day Outlook · NOAA Kp Forecast 3h · NOAA 3-Day Forecast ·
                observations FT8 PSK Reporter en zone ITU 27 · modèle DX Daruma pondéré par récence, SNR et similarité Kp/SFI.
              </p>
              <p className="mt-1">
                Dernière mise à jour : {new Date(data.fetchedAt).toLocaleString("fr-FR", { timeZone: "UTC" })} UTC
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
    </PremiumGate>
  );
}
