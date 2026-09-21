/**
 * Journal de calibration multi-bandes — entraînement J-12 → J-0.
 * Affiche jour par jour la fiabilité du modèle (prédiction vs spots réels sur
 * TOUTES les bandes contest), permet une capture manuelle "maintenant", et
 * détaille l'écart par bande+zone du jour sélectionné.
 */
import { useMemo, useState } from "react";
import { useCalibration, DaySummary, CalibRow } from "@/hooks/useCalibration";
import { cn } from "@/lib/utils";
import { Camera, Loader2, TrendingUp, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import { toast } from "sonner";

const ALL_BANDS = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
type Band = (typeof ALL_BANDS)[number];

function relColor(reliability: number): string {
  if (reliability >= 70) return "text-phosphor";
  if (reliability >= 45) return "text-primary";
  return "text-destructive";
}

function relBg(reliability: number): string {
  if (reliability >= 70) return "bg-phosphor";
  if (reliability >= 45) return "bg-primary";
  return "bg-destructive";
}

function bandColor(band: string): string {
  const colors: Record<string, string> = {
    "160m": "text-violet-400",
    "80m": "text-blue-400",
    "40m": "text-cyan-400",
    "20m": "text-yellow-400",
    "15m": "text-orange-400",
    "10m": "text-rose-400",
  };
  return colors[band] ?? "text-foreground";
}

export function CalibrationJournal() {
  const { byDay, global, isLoading, run } = useCalibration(14);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [bandFilter, setBandFilter] = useState<Band | "all">("all");

  const selected = useMemo<DaySummary | null>(() => {
    if (!byDay.length) return null;
    const d = selDate ?? byDay[0].date;
    return byDay.find((x) => x.date === d) ?? byDay[0];
  }, [byDay, selDate]);

  const capture = async () => {
    try {
      const r = await run.mutateAsync();
      if (r.ok) {
        const bandInfo = (r as any).bandCounts
          ? Object.entries((r as any).bandCounts as Record<string, number>)
              .filter(([, c]) => c > 0)
              .map(([b, c]) => `${b}:${c}`)
              .join(" · ")
          : "";
        toast.success(`Capture enregistrée · ${r.saved} lignes (6 bandes × 14 zones)`, {
          description: `${r.spotCount} spots analysés${bandInfo ? ` (${bandInfo})` : ""} · SFI ${r.solar.sfi ?? "?"} · Kp ${r.solar.kp ?? "?"}`,
        });
      } else {
        toast.error("Capture impossible", { description: r.error });
      }
    } catch (e) {
      toast.error("Capture impossible", { description: e instanceof Error ? e.message : "erreur" });
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête : fiabilité globale + bouton capture */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Gauge className={cn("h-5 w-5", relColor(global.reliability))} />
          <div>
            <div className={cn("font-mono text-lg font-extrabold leading-none", relColor(global.reliability))}>
              {global.reliability}%
            </div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Fiabilité 14 j</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
          <div className="font-mono text-lg font-extrabold leading-none text-foreground">{global.mae}</div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Écart moyen (pts)</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
          <div
            className={cn(
              "font-mono text-lg font-extrabold leading-none",
              global.bias > 10 ? "text-primary" : global.bias < -10 ? "text-destructive" : "text-foreground",
            )}
          >
            {global.bias > 0 ? "+" : ""}
            {global.bias}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Biais</div>
        </div>

        <button
          onClick={capture}
          disabled={run.isPending}
          className="ml-auto flex items-center gap-2 rounded-lg border border-phosphor/50 bg-phosphor/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-phosphor transition-all hover:bg-phosphor/20 active:scale-[0.97] disabled:opacity-50"
        >
          {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Capturer maintenant
        </button>
      </div>

      {/* Filtre par bande */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Bande :</span>
        <BandBtn band="all" active={bandFilter === "all"} onClick={() => setBandFilter("all")} />
        {ALL_BANDS.map((b) => (
          <BandBtn key={b} band={b} active={bandFilter === b} onClick={() => setBandFilter(b)} />
        ))}
      </div>

      {/* Lecture pédagogique du biais */}
      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-[11px] text-muted-foreground">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <strong className="text-foreground">Calibration multi-bandes</strong> — Chaque capture analyse les spots sur les
          6 bandes contest (160/80/40/20/15/10m) × 14 zones = 84 points de mesure. Filtrez par bande pour voir la fiabilité
          du modèle sur chaque segment. L'objectif : capturer aux mêmes heures que le concours (12-12 UTC) pour affiner les
          prédictions d'ouverture.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du journal…
        </div>
      ) : byDay.length === 0 ? (
        <EmptyState onCapture={capture} pending={run.isPending} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* Tableau jour par jour */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-[oklch(0.19_0.009_250)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Progression jour par jour
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-[oklch(0.19_0.009_250)] text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Jour</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 text-center font-medium">Créneaux</th>
                    <th className="px-2 py-2 text-right font-medium">Fiabilité</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((d) => {
                    const isSel = selected?.date === d.date;
                    const jLabel = d.dToContest > 0 ? `J-${d.dToContest}` : d.dToContest === 0 ? "JOUR J" : `J+${-d.dToContest}`;
                    return (
                      <tr
                        key={d.date}
                        onClick={() => setSelDate(d.date)}
                        className={cn(
                          "cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30",
                          isSel && "bg-primary/10",
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-xs font-bold text-primary">{jLabel}</td>
                        <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{d.date.slice(5)}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs tabular-nums text-foreground">{d.slots}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                              <div
                                className={cn("h-full rounded-full", relBg(d.accuracy.reliability))}
                                style={{ width: `${d.accuracy.reliability}%` }}
                              />
                            </div>
                            <span className={cn("font-mono text-xs font-bold tabular-nums", relColor(d.accuracy.reliability))}>
                              {d.accuracy.reliability}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Détail du jour sélectionné : écart par bande+zone */}
          {selected && <DayDetail day={selected} bandFilter={bandFilter} />}
        </div>
      )}
    </div>
  );
}

function BandBtn({ band, active, onClick }: { band: Band | "all"; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.97]",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {band === "all" ? "Toutes" : band}
    </button>
  );
}

function DayDetail({ day, bandFilter }: { day: DaySummary; bandFilter: Band | "all" }) {
  // agréger par bande+zone
  const byBandZone = useMemo(() => {
    const filteredRows = bandFilter === "all"
      ? day.rows
      : day.rows.filter((r) => (r as any).band === bandFilter);

    const map = new Map<string, { band: string; label: string; pred: number; real: number; spots: number; n: number }>();
    for (const r of filteredRows) {
      const band = (r as any).band || "40m";
      const key = `${band}:${r.zoneId}`;
      const cur = map.get(key) ?? { band, label: r.zoneLabel ?? r.zoneId, pred: 0, real: 0, spots: 0, n: 0 };
      cur.pred += r.predictedScore;
      cur.real += r.actualScore;
      cur.spots += r.actualSpots;
      cur.n += 1;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((z) => ({
        band: z.band,
        label: z.label,
        pred: Math.round(z.pred / z.n),
        real: Math.round(z.real / z.n),
        spots: z.spots,
        err: Math.round(z.pred / z.n) - Math.round(z.real / z.n),
      }))
      .sort((a, b) => {
        // Trier par bande puis par écart absolu décroissant
        const bandOrder = ALL_BANDS.indexOf(a.band as Band) - ALL_BANDS.indexOf(b.band as Band);
        if (bandOrder !== 0) return bandOrder;
        return Math.abs(b.err) - Math.abs(a.err);
      });
  }, [day, bandFilter]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-[oklch(0.19_0.009_250)] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Détail {bandFilter === "all" ? "toutes bandes" : bandFilter} · {day.date}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{byBandZone.length} lignes</span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[oklch(0.19_0.009_250)] text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {bandFilter === "all" && <th className="px-2 py-2 font-medium">Bande</th>}
              <th className="px-3 py-2 font-medium">Zone</th>
              <th className="px-2 py-2 text-right font-medium">Prédit</th>
              <th className="px-2 py-2 text-right font-medium">Réel</th>
              <th className="px-2 py-2 text-right font-medium">Spots</th>
              <th className="px-2 py-2 text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody>
            {byBandZone.map((z, i) => (
              <tr key={`${z.band}-${z.label}-${i}`} className="border-b border-border/50">
                {bandFilter === "all" && (
                  <td className={cn("px-2 py-2 font-mono text-[10px] font-bold", bandColor(z.band))}>{z.band}</td>
                )}
                <td className="px-3 py-2 text-xs text-foreground">{z.label}</td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-primary">{z.pred}</td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-phosphor">{z.real}</td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">{z.spots}</td>
                <td className="px-2 py-2 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums",
                      Math.abs(z.err) <= 15 ? "text-phosphor" : Math.abs(z.err) <= 35 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {Math.abs(z.err) <= 15 ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {z.err > 0 ? "+" : ""}
                    {z.err}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ onCapture, pending }: { onCapture: () => void; pending: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
      <Camera className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Aucune capture pour l'instant.</p>
      <p className="max-w-md text-xs text-muted-foreground/70">
        Lancez une première capture pour comparer la prédiction d'ouverture multi-bandes aux spots réels.
        Chaque capture analyse les 6 bandes contest × 14 zones = 84 points de mesure.
        Répétez chaque jour (idéalement aux heures du concours, 12-12 UTC) pour entraîner le modèle.
      </p>
      <button
        onClick={onCapture}
        disabled={pending}
        className="mt-2 flex items-center gap-2 rounded-lg border border-phosphor/50 bg-phosphor/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-phosphor transition-all hover:bg-phosphor/20 active:scale-[0.97] disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        Première capture
      </button>
    </div>
  );
}
