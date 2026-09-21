/**
 * DX Hunter — Page principale style DXHeat
 * Layout : Filtres (gauche) | Tableau spots (centre) | Panneau station (droite)
 * Thème dual clair/sombre via variables CSS
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSpots } from "@/hooks/useSpots";
import { Spot, ModeFamily, TRACKED_BANDS, WARC_BANDS, utcClock, fmtFreq, displayMode } from "@/lib/dx";
import { FilterPanel, Filters } from "@/components/FilterPanel";
import { SpotRow } from "@/components/SpotRow";
import { SpotDetail } from "@/components/SpotDetail";


import { SolarBar } from "@/components/SolarBar";
import { PlanTicker } from "@/components/PlanTicker";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { SelfMonitor } from "@/components/SelfMonitor";
import { PropagationAlert } from "@/components/PropagationAlert";
import { PremiumGate } from "@/components/PremiumGate";
import { TrialBanner } from "@/components/TrialBanner";
import { TargetPanel } from "@/components/TargetPanel";
import { useTargets } from "@/hooks/useTargets";
import { usePresence } from "@/hooks/usePresence";
import { useWorkedCalls } from "@/hooks/useWorkedCalls";
import { useFlexCat } from "@/hooks/useFlexCat";
import { trpc } from "@/lib/trpc";
import { LogQsoDialog } from "@/components/LogQsoDialog";
import { RotorWidget } from "@/components/RotorWidget";
import { useRotor } from "@/hooks/useRotor";




import { playBeep, unlockAudio } from "@/lib/beep";
import { cn } from "@/lib/utils";
import { RefreshCw, Crosshair, Radio, AlertTriangle, Target, Calendar, Newspaper, Sun, Moon, Menu, Headphones } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Link } from "wouter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getUserQTH, bearingDistance } from "@/lib/propagation";
import { useVisitorId } from "@/hooks/useVisitorId";

import { findDxccByCallsign } from "@shared/dxccEntities";
import { Globe } from "lucide-react";

const LOGO = "/manus-storage/daruma-logo_7b6015da.jpeg";

const DEFAULT_FILTERS: Filters = {
  bands: new Set([...TRACKED_BANDS]),
  families: new Set<ModeFamily>(["SSB"]),
  continents: new Set(),
  rareOnly: false,
  search: "",
  soundOn: false,
  sporadicAlert: true,
  onlyNewDxcc: false,
};

export default function Home() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const visitorId = useVisitorId();
  const userQth = useMemo(() => getUserQTH(user?.locator), [user?.locator]);
  const { targets, addTarget, removeTarget, clear } = useTargets();
  const { spots, conn, lastUpdate, newIds, refresh } = useSpots();
  const { solarInputs } = useSpaceWeather();
  const onlineCount = usePresence();
  const { isWorked, markWorked, workedCount, isOob, markOob } = useWorkedCalls();
  const { qsy, radioConnected, currentFreq, currentMode, so2r, qsyMulti, swapAndQsy, swap } = useFlexCat({ autoConnect: true });
  const { goTo: rotorGoTo } = useRotor();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [logDialogSpot, setLogDialogSpot] = useState<Spot | null>(null);
  const [showFilters, setShowFilters] = useState(false);


  // ─── Données DXCC travaillés (pour alertes DXCC nouveau) ────────────────────
  const { data: dxccWorkedData } = trpc.dxcc.getWorked.useQuery(
    { visitorId },
    { enabled: !!visitorId, staleTime: 30_000 }
  );
  const workedDxccCodes = useMemo(() => {
    const s = new Set<string>();
    if (dxccWorkedData) for (const w of dxccWorkedData) s.add(w.dxccCode);
    return s;
  }, [dxccWorkedData]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clock, setClock] = useState(utcClock());
  const [pinnedSpot, setPinnedSpot] = useState<Spot | null>(null);

  // horloge UTC
  useEffect(() => {
    const t = setInterval(() => setClock(utcClock()), 1000);
    return () => clearInterval(t);
  }, []);

  // filtrage — limité à la dernière heure
  const filtered = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    const oneHourAgo = Date.now() / 1000 - 3600;
    let list = spots.filter((s) => {
      if (s.received_time < oneHourAgo) return false;
      if (isWorked(s.dx_call, s.band || undefined)) return false;
      if (isOob(s.dx_call, s.freqKhz)) return false;
      if (s.band && !filters.bands.has(s.band)) return false;
      if (!filters.families.has(s.family)) return false;
      if (filters.continents.size && (!s.dx_continent || !filters.continents.has(s.dx_continent)))
        return false;
      if (filters.rareOnly && !s.isRare) return false;
      if (filters.onlyNewDxcc) {
        const entity = findDxccByCallsign(s.dx_call);
        if (entity && workedDxccCodes.has(entity.code)) return false;
      }
      if (q) {
        const hay = `${s.dx_call} ${s.dx_country ?? ""} ${s.mode ?? ""} ${s.comment ?? ""}`.toUpperCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const at = a.isTarget ? 0 : 1;
      const bt = b.isTarget ? 0 : 1;
      if (at !== bt) return at - bt;
      return b.received_time - a.received_time;
    });
    return list;
  }, [spots, filters, isWorked, isOob, workedDxccCodes]);

  const displayList = useMemo(() => {
    if (!pinnedSpot) return filtered;
    const withoutPinned = filtered.filter((s) => s.id !== pinnedSpot.id);
    const fresh = spots.find((s) => s.id === pinnedSpot.id);
    return [fresh ?? pinnedSpot, ...withoutPinned];
  }, [filtered, pinnedSpot, spots]);

  // alertes sonores sur nouveaux spots SSB / rares pertinents
  const lastAlert = useRef(0);
  useEffect(() => {
    if (!filters.soundOn || newIds.size === 0) return;
    const relevant = filtered.filter((s) => newIds.has(s.id));
    const target = relevant.find((s) => s.isTarget);
    const rare = relevant.find((s) => s.isRare);
    const ssb = relevant.find((s) => s.family === "SSB");
    const now = Date.now();
    if (now - lastAlert.current < 2500) return;
    if (target) {
      lastAlert.current = now;
      playBeep("rare");
      toast(`CIBLE EN VUE : ${target.dx_call}`, {
        description: `${target.dx_country ?? ""} · ${target.band} · ${displayMode(target.mode, target.freqKhz)} · ${fmtFreq(target.freqKhz)} kHz`,
        icon: <Target className="h-4 w-4 text-amber-400" />,
        duration: 8000,
      });
    } else if (rare) {
      lastAlert.current = now;
      playBeep("rare");
      toast(`DX RARE : ${rare.dx_call}`, {
        description: `${rare.dx_country ?? ""} · ${rare.band} · ${displayMode(rare.mode, rare.freqKhz)}`,
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      });
    } else if (ssb) {
      lastAlert.current = now;
      playBeep("ssb");
    }
  }, [newIds, filtered, filters.soundOn]);

  // ─── Alerte DXCC nouveau ──────────────────────────────────────────────
  const lastDxccAlert = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!filters.soundOn || newIds.size === 0) return;
    const newSpots = spots.filter((s) => newIds.has(s.id));
    for (const spot of newSpots) {
      const entity = findDxccByCallsign(spot.dx_call);
      if (!entity) continue;
      if (workedDxccCodes.has(entity.code)) continue;
      const lastTime = lastDxccAlert.current[entity.code] || 0;
      if (Date.now() - lastTime < 5 * 60 * 1000) continue;
      lastDxccAlert.current[entity.code] = Date.now();
      playBeep("rare");
      toast(`DXCC NOUVEAU : ${spot.dx_call}`, {
        description: `${entity.name} (${entity.code}) · ${spot.band} · ${displayMode(spot.mode, spot.freqKhz)} · ${fmtFreq(spot.freqKhz)} kHz`,
        icon: <Globe className="h-4 w-4 text-emerald-400" />,
        duration: 12000,
        action: {
          label: "Voir DXCC",
          onClick: () => window.location.href = "/dxcc",
        },
      });
      break;
    }
  }, [newIds, spots, filters.soundOn, workedDxccCodes]);

  const counts = useMemo(() => {
    const ssb = filtered.filter((s) => s.family === "SSB").length;
    const rare = filtered.filter((s) => s.isRare).length;
    const target = filtered.filter((s) => s.isTarget).length;
    return { total: filtered.length, ssb, rare, target };
  }, [filtered]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Logo + titre */}
          <img src={LOGO} alt="DX Daruma" className="h-8 w-8 shrink-0 rounded-full" />
          <h1 className="font-mono text-base font-extrabold tracking-tight leading-none shrink-0">
            DX<span className="text-primary"> DARUMA</span>
          </h1>


          {/* Accès rapide Écoute DX — administrateur uniquement */}
          {user?.role === "admin" && (
            <Link
              href="/ecoute-dx"
              className="hidden sm:flex ml-1 items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.08)] transition-all hover:border-cyan-300 hover:bg-cyan-400/20 active:scale-[0.97]"
              title="Recherche inversée par fréquence, direction et KiwiSDR"
            >
              <Headphones className="h-3.5 w-3.5" />
              Écoute DX
            </Link>
          )}


          {/* Widget Rotor (boussole) — admin uniquement */}
          {user?.role === "admin" && (
            <div className="hidden sm:block ml-2">
              <RotorWidget />
            </div>
          )}

          {/* Indicateur fréquence + mode (lecture seule) */}
          <RigIndicator radioConnected={radioConnected} currentFreq={currentFreq} currentMode={currentMode} className="hidden sm:flex" />

          {/* Outils droite */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Compteurs — masqués sur mobile */}
            <div className="hidden lg:flex items-center gap-3">
              {counts.target > 0 && <Stat label="Cibles" value={counts.target} accent="text-amber-500" />}
              <Stat label="SSB" value={counts.ssb} accent="text-emerald-500" />
              <Stat label="Total" value={counts.total} accent="text-foreground" />
              <Stat label="Rare" value={counts.rare} accent="text-red-500" />
            </div>

            {/* Horloge UTC — compacte sur mobile */}
            <div className="rounded-lg border border-border bg-background px-2 sm:px-3 py-1 text-center">
              <div className="font-mono text-sm sm:text-lg font-bold text-primary tabular-nums leading-tight">{clock}</div>
              <div className="text-[8px] sm:text-[9px] uppercase tracking-widest text-muted-foreground font-medium">UTC</div>
            </div>

            {/* Indicateurs — masqués sur mobile */}
            <div className="hidden sm:flex items-center gap-1.5">
              <ConnBadge conn={conn} lastUpdate={lastUpdate} />
              <CatIndicator />
            </div>

            {/* Toggle thème */}
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-[0.95]"
              title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Refresh */}
            <button
              onClick={() => { unlockAudio(); refresh(); }}
              title={t("refresh")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-[0.95]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {/* Langue — masquée sur mobile */}
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>

            {/* Online */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono tabular-nums">{onlineCount}</span>
            </div>

            {/* Mobile hamburger */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary transition-all">
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-card border-border p-0 overflow-y-auto">
                <div className="p-4 border-b border-border">
                  <h2 className="font-mono text-sm font-bold">Navigation</h2>
                </div>
                <nav className="p-3 flex flex-col gap-1">
                  {user?.role === "admin" && <Link href="/ecoute-dx" className="flex items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2.5 text-sm font-bold text-cyan-300"><Headphones className="h-4 w-4" />Écoute DX</Link>}
                  <Link href="/pilot" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"><Crosshair className="h-4 w-4 text-primary" />{t("pilot")}</Link>
                  <Link href="/forecast" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"><Calendar className="h-4 w-4 text-primary" />{t("forecast7d")}</Link>
                  <Link href="/dxinfo" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"><Newspaper className="h-4 w-4 text-primary" />Infos DX</Link>
                </nav>
                {/* Indicateur fréquence + mode + rotor dans le menu mobile */}
                <div className="mx-3 mt-2 p-3 rounded-lg border border-border bg-background">
                  <RigIndicator radioConnected={radioConnected} currentFreq={currentFreq} currentMode={currentMode} className="flex" />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Barre solaire */}
        <div className="border-t border-border/60 bg-muted/30 overflow-x-auto">
          <SolarBar />
        </div>
        {/* Plan 24h + liens rapides */}
        <div id="plan-ticker" className="border-t border-border/60 bg-muted/20 flex items-center gap-2 px-3">
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            <Link href="/pilot" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Crosshair className="h-3 w-3" />{t("pilot")}</Link>
            <Link href="/forecast" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Calendar className="h-3 w-3" />{t("forecast7d")}</Link>
            <Link href="/dxinfo" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Newspaper className="h-3 w-3" />Infos DX</Link>
          </nav>
          <div className="flex-1 overflow-hidden">
            <PlanTicker solar={solarInputs} qth={userQth} />
          </div>
        </div>
      </header>

      <TrialBanner />
      {filters.sporadicAlert && <PropagationAlert />}

      {/* ===== CORPS : 2 colonnes (spots + panneau droit) ===== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── CENTRE : Tableau de spots (pleine largeur) ─── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Barre sous-header : Filtres (bouton overlay) + compteur + recherche */}
          <div className="flex items-center gap-1.5 sm:gap-2 border-b border-border bg-card px-2 sm:px-4 py-1.5 sm:py-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className={cn("absolute inline-flex h-full w-full rounded-full", conn === "online" ? "bg-red-500 pulse-live" : "bg-muted")} />
                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", conn === "online" ? "bg-red-500" : "bg-muted")} />
              </span>
              <h2 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                <span className="hidden sm:inline">Cluster DX </span><span className="text-muted-foreground font-normal text-[10px] sm:text-xs">({filtered.length})</span>
              </h2>

              {/* Bouton Filtres — juste à côté du titre */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <button className="flex items-center gap-1 rounded-lg border border-primary/60 bg-primary/10 px-2 py-1 text-[11px] sm:text-xs font-bold text-primary hover:bg-primary/20 transition-all active:scale-[0.97]">
                    <Crosshair className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Filtres</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] sm:w-[320px] md:w-[360px] bg-card border-border p-0 overflow-y-auto">
                  <div className="p-4 border-b border-border">
                    <h2 className="font-mono text-sm font-bold uppercase tracking-wider">Filtres & Cibles</h2>
                  </div>
                  <div className="p-4 space-y-4 text-sm">
                    <FilterPanel filters={filters} onChange={setFilters} />
                    <button
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="w-full rounded-lg border border-border py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      {t("resetFilters")}
                    </button>
                    <div className="border-t border-border pt-4">
                      <TargetPanel targets={targets} count={counts.target} onAdd={addTarget} onRemove={removeTarget} onClear={clear} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>



          {/* SelfMonitor — toujours visible */}
          <div className="border-b border-border bg-card px-2 sm:px-4 py-2 sm:py-3">
            <PremiumGate mode="overlay" featureName="WebSDR">
              <SelfMonitor
                rigFreqMhz={radioConnected && currentFreq > 0 ? currentFreq : undefined}
                rigMode={radioConnected ? currentMode : undefined}
              />
            </PremiumGate>
          </div>

          {/* Tableau */}
          <div className="flex-1 overflow-auto spot-table thin-scrollbar">
            {filtered.length === 0 ? (
              <EmptyState conn={conn} />
            ) : (
              <table className="w-full border-collapse text-[11px] sm:text-xs">
                <thead className="sticky top-0 z-10 bg-muted text-left">
                  <tr className="border-b border-border uppercase tracking-wider text-muted-foreground">
                    <th className="px-1.5 sm:px-3 py-2 sm:py-2.5 font-semibold w-[44px] sm:w-[50px]">UTC</th>
                    <th className="px-1.5 sm:px-3 py-2 sm:py-2.5 font-semibold w-[48px] sm:w-[60px]">Bande</th>
                    <th className="hidden sm:table-cell px-1.5 sm:px-3 py-2 sm:py-2.5 font-semibold text-right w-[90px] sm:w-[110px]">Fréq</th>
                    <th className="hidden md:table-cell px-3 py-2.5 font-semibold w-[60px]">Mode</th>
                    <th className="px-1.5 sm:px-3 py-2 sm:py-2.5 font-semibold">DX</th>
                    <th className="hidden sm:table-cell px-1.5 sm:px-3 py-2 sm:py-2.5 font-semibold w-[100px] sm:w-[140px]">Pays</th>
                    <th className="hidden lg:table-cell px-3 py-2.5 font-semibold">Commentaires</th>
                    <th className="hidden lg:table-cell px-3 py-2.5 font-semibold text-right w-[100px]">Dist / Az</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((s) => (
                    <React.Fragment key={s.id}>
                      <SpotRow
                        spot={s}
                        isNew={newIds.has(s.id)}
                        isHovered={hoveredId === s.id}
                        isExpanded={expandedId === s.id}
                        isWorked={isWorked(s.dx_call, s.band || undefined)}
                        isOob={isOob(s.dx_call, s.freqKhz)}
                        userLat={userQth.lat}
                        userLon={userQth.lon}
                        onHover={setHoveredId}
                        onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        onMarkWorked={(dxCall, band) => {
                          const spot = filtered.find(sp => sp.dx_call === dxCall && (band ? sp.band === band : true));
                          if (spot) {
                            setLogDialogSpot(spot);
                          } else {
                            markWorked(dxCall, band);
                          }
                        }}
                        onMarkOob={markOob}
                        onQsy={user?.role === "admin" ? (freqKhz, mode) => {
                          const freqMHz = freqKhz / 1000;
                          if (so2r.enabled) {
                            // SO2R actif : QSY va vers le poste MULTI
                            const ok = qsyMulti(freqMHz, mode);
                            if (ok) {
                              toast.success(`QSY MULTI → ${freqMHz.toFixed(3)} MHz ${mode || ""}`);
                              setPinnedSpot(s);
                            } else {
                              toast.error("CAT non connecté");
                            }
                          } else {
                            const ok = qsy(freqMHz, mode);
                            if (ok) {
                              toast.success(`QSY → ${freqMHz.toFixed(3)} MHz ${mode || ""}`);
                              setPinnedSpot(s);
                            } else {
                              toast.error("CAT non connecté");
                            }
                          }
                        } : undefined}
                        catConnected={radioConnected}
                        onRotor={user?.role === "admin" ? (bearing) => {
                          rotorGoTo(bearing);
                          toast.success(`Rotor → ${bearing}°`, { icon: "🧭" });
                        } : undefined}
                        isPinned={pinnedSpot?.id === s.id}
                        onUnpin={() => setPinnedSpot(null)}
                      />
                      {expandedId === s.id && (
                        <SpotDetail
                          spot={s}
                          onClose={() => setExpandedId(null)}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground bg-card">
        DX HUNTER · données agrégées via l'API publique Spothole (clusters DX + RBN) · à but informatif
      </footer>

      {/* Dialog de log QSO */}
      {logDialogSpot && (
        <LogQsoDialog
          spot={logDialogSpot}
          visitorId={visitorId}
          onConfirm={(dxCall, band) => {
            markWorked(dxCall, band);
            setLogDialogSpot(null);
          }}
          onCancel={() => setLogDialogSpot(null)}
        />
      )}
    </div>
  );
}

/* ─── Composants utilitaires ─── */

function RigIndicator({ radioConnected, currentFreq, currentMode, className = "" }: {
  radioConnected: boolean;
  currentFreq: number;
  currentMode: string | null;
  className?: string;
}) {
  const prevFreqRef = useRef(currentFreq);
  const [freqFlash, setFreqFlash] = useState(false);

  useEffect(() => {
    if (currentFreq !== prevFreqRef.current && currentFreq > 0) {
      setFreqFlash(true);
      const t = setTimeout(() => setFreqFlash(false), 600);
      prevFreqRef.current = currentFreq;
      return () => clearTimeout(t);
    }
  }, [currentFreq]);

  return (
    <div className={cn("items-center gap-2 ml-3 font-mono text-xs tabular-nums", className)}>
      {radioConnected && currentFreq > 0 ? (
        <span className={cn("text-primary font-bold transition-all duration-300", freqFlash && "scale-110 brightness-150")}>
          {currentFreq.toFixed(3)} MHz
        </span>
      ) : (
        <span className="text-muted-foreground/50">--- MHz</span>
      )}
      {radioConnected && currentMode && (
        <span className="text-amber-400/90 font-semibold text-[10px] ml-0.5">{currentMode.toUpperCase()}</span>
      )}
    </div>
  );
}


function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="text-center">
      <div className={cn("font-mono text-lg font-extrabold leading-none tabular-nums", accent)}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function ConnBadge({ conn, lastUpdate }: { conn: string; lastUpdate: number | null }) {
  const { t } = useI18n();
  const map: Record<string, { txt: string; cls: string }> = {
    online: { txt: t("connected"), cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    connecting: { txt: t("connecting"), cls: "border-primary/50 bg-primary/10 text-primary" },
    error: { txt: t("disconnected"), cls: "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400" },
  };
  const m = map[conn] ?? map.connecting;
  return (
    <div className={cn("hidden sm:block rounded-lg border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider", m.cls)}>
      {m.txt}
    </div>
  );
}

function EmptyState({ conn }: { conn: string }) {
  const { t } = useI18n();
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      {conn === "error" ? (
        <>
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{t("error")}</p>
        </>
      ) : (
        <>
          <Radio className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("noSpotMatch")}</p>
        </>
      )}
    </div>
  );
}

/** Indicateur CAT compact pour le header */
function CatIndicator() {
  const { bridgeConnected, radioConnected, currentFreq, currentMode } = useFlexCat({ autoConnect: true });
  return (
    <div
      className={cn(
        "hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide",
        radioConnected
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : bridgeConnected
            ? "border-orange-500/40 bg-orange-500/10 text-orange-500"
            : "border-border bg-muted/30 text-muted-foreground/50"
      )}
      title={radioConnected ? "FlexRadio connecté via CAT Bridge" : bridgeConnected ? "Bridge connecté, radio non détectée" : "CAT non connecté"}
    >
      <Radio className="h-3 w-3" />
      {radioConnected && currentFreq > 0 ? (
        <span className="tabular-nums">{currentFreq.toFixed(3)}</span>
      ) : (
        <span>{radioConnected ? "FLEX" : bridgeConnected ? "BRIDGE" : "CAT"}</span>
      )}
      {radioConnected && currentMode && (
        <span className="text-[8px] opacity-70">{currentMode.toUpperCase()}</span>
      )}
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          radioConnected
            ? "bg-emerald-400 animate-pulse"
            : bridgeConnected
              ? "bg-orange-400"
              : "bg-muted-foreground/30"
        )}
      />
    </div>
  );
}
