/**
 * Page "Pilotage" — poste de commandement multi-bandes pour le contest.
 * Deux modes :
 * - Par bande : pilotage spécifique à une bande (160/80/40/20/15/10m)
 * - Général : vue d'ensemble toutes bandes avec recommandations croisées
 *
 * Réunit : recommandations live (azimut/chemin/rôle), fenêtre glissante,
 * briefing par phase, suivi des multiplicateurs, timeline du concours et
 * grille WebSDR multi-continents.
 */
import { useEffect, useMemo, useState } from "react";
import { useSpots } from "@/hooks/useSpots";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { usePilot } from "@/hooks/usePilot";
import { SolarVerdict } from "@/components/SolarVerdict";
import { utcClock } from "@/lib/dx";
import { DEFAULT_QTH_LOCATOR, locatorToLatLon } from "@/lib/propagation";
import { useAuth } from "@/_core/hooks/useAuth";
import { NavBar } from "@/components/NavBar";
import { RecoPanel } from "@/components/RecoPanel";
import { MultTracker } from "@/components/MultTracker";
import { ContestTimeline } from "@/components/ContestTimeline";
import { WebSDRGrid } from "@/components/WebSDRGrid";
import { Briefing } from "@/components/Briefing";
import { CalibrationJournal } from "@/components/CalibrationJournal";
import { SelfMonitor } from "@/components/SelfMonitor";
import { PilotGeneral } from "@/components/PilotGeneral";
import { Compass, Target, CalendarClock, Headphones, ClipboardList, Activity, Gauge, Radio, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumGate } from "@/components/PremiumGate";
import { ContestBand, ALL_CONTEST_BANDS, buildBandTimeline, BandTimelineSlot, QthCoords } from "@/lib/propagationMultiBand";

type Tab = "live" | "brief" | "mult" | "timeline" | "websdr" | "selfmon" | "calib";
type PilotMode = "band" | "general";

export default function Pilot() {
  const { user } = useAuth();
  const userLocator = user?.locator || DEFAULT_QTH_LOCATOR;
  const userQth: QthCoords = useMemo(() => {
    const coords = locatorToLatLon(userLocator);
    return coords ? { lat: coords.lat, lon: coords.lon } : { lat: 45.27, lon: 5.29 };
  }, [userLocator]);
  const { spots } = useSpots();
  const { sw, solarInputs } = useSpaceWeather();
  const kIndex = sw.kpNow;

  const [pilotMode, setPilotMode] = useState<PilotMode>("general");
  const [selectedBand, setSelectedBand] = useState<ContestBand>("40m");

  // Filtrer les spots par bande sélectionnée
  const spotsBand = useMemo(
    () => pilotMode === "band" ? spots.filter((s) => s.band === selectedBand) : spots,
    [spots, selectedBand, pilotMode]
  );

  // Pour le mode "par bande", on utilise le hook usePilot existant (adapté au 40m)
  // Pour les autres bandes, on utilise le modèle multi-bandes
  const pilot = usePilot(
    pilotMode === "band" && selectedBand === "40m"
      ? spots.filter((s) => s.band === "40m")
      : spots.filter((s) => s.band === "40m"), // usePilot reste sur 40m pour les mults ITU/HQ
    solarInputs,
    userQth
  );

  // Timeline multi-bandes
  const bandTimeline = useMemo(
    () => pilotMode === "band" ? buildBandTimeline(selectedBand, solarInputs, 0, userQth) : [],
    [selectedBand, solarInputs, pilotMode, userQth]
  );

  const [clock, setClock] = useState(utcClock());
  const [tab, setTab] = useState<Tab>("live");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => {
      setClock(utcClock());
      setNow(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const nowHourUTC = now.getUTCHours();

  const ituMissing = pilot.multStatus.ituZones.filter((z) => !z.worked).length;

  const modeLabel = pilotMode === "general"
    ? "Général (toutes bandes)"
    : `${selectedBand} — par bande`;

  return (
    <PremiumGate mode="block" featureName="Pilotage">
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-[oklch(0.16_0.009_250)]/95 backdrop-blur-md">
        <NavBar
          clock={clock}
          right={
            <div className="hidden items-center gap-3 md:flex">
              <HeaderStat label="QTH" value={userLocator} accent="text-foreground" mono />
              <HeaderStat label="Mode" value={pilotMode === "general" ? "GÉN" : selectedBand} accent="text-cyan-400" />
              <HeaderStat label="Live" value={String(spotsBand.length)} accent="text-phosphor" />
              <HeaderStat label="Mult manq." value={String(ituMissing)} accent="text-primary" />
              {kIndex != null && (
                <HeaderStat label="K" value={String(kIndex)} accent={kIndex >= 4 ? "text-destructive" : "text-phosphor"} />
              )}
            </div>
          }
        />

        {/* Sélecteur de mode pilotage */}
        <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5 sm:px-5">
          <Layers className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-cyan-400">Mode :</span>
          <button
            onClick={() => setPilotMode("general")}
            className={cn(
              "rounded px-2 py-1 font-mono text-[10px] font-bold uppercase transition-all active:scale-[0.95]",
              pilotMode === "general"
                ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            )}
          >
            Général
          </button>
          <span className="text-[9px] text-muted-foreground/50">|</span>
          {ALL_CONTEST_BANDS.map((b) => (
            <button
              key={b}
              onClick={() => { setPilotMode("band"); setSelectedBand(b); }}
              className={cn(
                "rounded px-2 py-1 font-mono text-[10px] font-bold uppercase transition-all active:scale-[0.95]",
                pilotMode === "band" && selectedBand === b
                  ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-3 py-1.5 sm:px-5">
          <TabBtn active={tab === "live"} onClick={() => setTab("live")} icon={Compass} label="Recommandations" />
          <TabBtn active={tab === "brief"} onClick={() => setTab("brief")} icon={ClipboardList} label="Briefing" />
          <TabBtn active={tab === "mult"} onClick={() => setTab("mult")} icon={Target} label="Multiplicateurs" />
          <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")} icon={CalendarClock} label="Plan 24h" />
          <TabBtn active={tab === "websdr"} onClick={() => setTab("websdr")} icon={Headphones} label="WebSDR" />
          <TabBtn active={tab === "selfmon"} onClick={() => setTab("selfmon")} icon={Radio} label="Self-Monitor" />
          <TabBtn active={tab === "calib"} onClick={() => setTab("calib")} icon={Gauge} label="Calibration" />
        </div>
      </header>

      <div className="flex-1 p-3 sm:p-4">
        {/* Bandeau fenêtre glissante */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs font-bold text-primary">{pilot.window.label}</span>
          <span className="text-[11px] text-muted-foreground">
            {pilot.window.from.toISOString().slice(11, 16)}Z → {pilot.window.to.toISOString().slice(11, 16)}Z
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {modeLabel} · SSB · Recommandations en continu
          </span>
        </div>

        {tab === "live" && (
          pilotMode === "general" ? (
            <PilotGeneral solar={solarInputs} spots={spots} sw={sw} qth={userQth} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <section className="rounded-lg border border-border bg-card p-4">
                <SectionTitle icon={Compass} title={`Où viser maintenant — ${selectedBand}`} />
                <div className="mb-3"><SolarVerdict sw={sw} /></div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Zones triées par potentiel de propagation {selectedBand} + multiplicateurs manquants + activité réelle.
                  Le cap tient compte du short path (SP) ou long path (LP) depuis {userLocator}.
                </p>
                {selectedBand === "40m" ? (
                  <RecoPanel recos={pilot.recommendations} />
                ) : (
                  <BandRecoPanel band={selectedBand} solar={solarInputs} qth={userQth} />
                )}
              </section>
              <aside className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <SectionTitle icon={CalendarClock} title="Prochaines heures" />
                  <BandTimelineCompact slots={bandTimeline} nowHourUTC={nowHourUTC} />
                </div>
              </aside>
            </div>
          )
        )}

        {tab === "brief" && (
          <section className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={ClipboardList} title="Briefing de préparation & rôles" />
            <Briefing now={now} />
          </section>
        )}

        {tab === "mult" && (
          <section className="rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={Target} title={`Suivi des multiplicateurs${pilotMode === "band" ? ` (${selectedBand})` : ""}`} />
            <p className="mb-3 text-[11px] text-muted-foreground">
              Cliquez pour marquer "travaillé". Les zones/sociétés <span className="text-primary">spottées</span> mais
              non travaillées clignotent : ce sont vos prochaines cibles.
            </p>
            <MultTracker
              status={pilot.multStatus}
              onToggleItu={pilot.toggleItu}
              onToggleHq={pilot.toggleHq}
            />
          </section>
        )}

        {tab === "timeline" && (
          <section className="rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={CalendarClock} title={`Plan horaire 24h${pilotMode === "band" ? ` — ${selectedBand}` : " — Général"}`} />
            <p className="mb-3 text-[11px] text-muted-foreground">
              Prévision des meilleures directions heure par heure.
              {pilotMode === "band"
                ? ` Spécifique au ${selectedBand}. Pastille verte = très bon, ambre = moyen.`
                : " Vue d'ensemble toutes bandes. La meilleure bande est indiquée pour chaque créneau."}
            </p>
            {pilotMode === "band" ? (
              <BandTimelineFull slots={bandTimeline} nowHourUTC={nowHourUTC} />
            ) : (
              <ContestTimeline slots={pilot.timeline} nowHourUTC={nowHourUTC} />
            )}
          </section>
        )}

        {tab === "websdr" && (
          <section className="rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={Headphones} title="Grille WebSDR multi-continents" />
            <WebSDRGrid />
          </section>
        )}

        {tab === "selfmon" && (
          <section className="rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={Radio} title="Self-Monitor — Écoute de votre signal sur WebSDR" />
            <p className="mb-3 text-[11px] text-muted-foreground">
              Trouvez les WebSDR qui peuvent vous entendre le long de votre corridor de propagation.
            </p>
            <SelfMonitor />
          </section>
        )}

        {tab === "calib" && (
          <section className="rounded-lg border border-border bg-card p-4">
            <SectionTitle icon={Gauge} title="Journal de calibration — entraînement" />
            <p className="mb-3 text-[11px] text-muted-foreground">
              Compare la prédiction d'ouverture du modèle aux spots réels, jour par jour.
            </p>
            <CalibrationJournal />
          </section>
        )}
      </div>

      <footer className="border-t border-border px-4 py-2 text-center font-mono text-[10px] text-muted-foreground/60">
        PILOTAGE CONTEST · {modeLabel} · modèle de propagation indicatif — toujours confirmer à l'écoute
      </footer>
    </div>
    </PremiumGate>
  );
}

/* ===== Composants internes ===== */

function BandRecoPanel({ band, solar, qth }: { band: ContestBand; solar: import("@/lib/propagation").SolarInputs; qth?: QthCoords }) {
  const timeline = useMemo(() => buildBandTimeline(band, solar, 0, qth), [band, solar, qth]);
  const nowSlot = timeline[0]; // premier slot = heure courante

  if (!nowSlot || nowSlot.zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune ouverture détectée pour le {band} à cette heure.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="font-mono text-xs font-bold text-primary mb-1">{nowSlot.headline}</div>
        <div className="text-[11px] text-muted-foreground">Score global : {nowSlot.bandScore}/100</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {nowSlot.zones.map((z, i) => (
          <div key={i} className="flex items-center gap-2 rounded border border-border/60 bg-card/60 px-3 py-2">
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
    </div>
  );
}

function BandTimelineCompact({ slots, nowHourUTC }: { slots: BandTimelineSlot[]; nowHourUTC: number }) {
  // Affiche les 6 prochains créneaux
  const upcoming = slots.filter((s) => {
    const diff = (s.hourUTC - nowHourUTC + 24) % 24;
    return diff >= 0 && diff < 6;
  }).slice(0, 6);

  return (
    <div className="space-y-1">
      {upcoming.map((slot, i) => {
        const isNow = slot.hourUTC === nowHourUTC;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 rounded border px-2 py-1.5",
              isNow ? "border-primary bg-primary/10" : "border-border/60 bg-card/40"
            )}
          >
            <div className="w-10 shrink-0 text-center">
              <div className={cn("font-mono text-xs font-bold", isNow ? "text-primary" : "text-foreground")}>
                {String(slot.hourUTC).padStart(2, "0")}h
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-medium text-foreground/90">{slot.headline}</div>
              <div className="flex gap-1 mt-0.5">
                {slot.zones.slice(0, 3).map((z, j) => (
                  <span key={j} className="font-mono text-[8px] text-muted-foreground">
                    {z.az}°{z.path === "LP" ? "LP" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BandTimelineFull({ slots, nowHourUTC }: { slots: BandTimelineSlot[]; nowHourUTC: number }) {
  return (
    <div className="space-y-1">
      {slots.map((slot, i) => {
        const isNow = slot.hourUTC === nowHourUTC;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 rounded border px-2 py-1.5 transition-colors",
              isNow ? "border-primary bg-primary/10" : "border-border/60 bg-card/40"
            )}
          >
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
                    {z.az}° {z.path === "LP" ? "LP" : ""}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 w-10 text-right">
              <div className={cn(
                "font-mono text-xs font-bold",
                slot.bandScore >= 65 ? "text-phosphor" : slot.bandScore >= 40 ? "text-primary" : "text-muted-foreground"
              )}>
                {slot.bandScore}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Compass; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{title}</h2>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Compass;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all active:scale-[0.97]",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function HeaderStat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent: string;
  mono?: boolean;
}) {
  return (
    <div className="text-right">
      <div className={cn("text-base font-extrabold leading-none", accent, mono && "font-mono")}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
