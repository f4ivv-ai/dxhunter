/**
 * Page DXCC Tracker — Suivi des entités DXCC travaillées.
 * Données issues du logbook (table dxcc_worked).
 * Vue par entité, filtres bande/mode, progression.
 */
import { useState, useMemo, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useVisitorId } from "@/hooks/useVisitorId";
import { TRACKED_BANDS } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { DXCC_ENTITIES } from "@shared/dxccEntities";
import {
  ArrowLeft,
  Globe,
  Radio,
  BookOpen,
  Filter,
  X,
  CheckCircle2,
  Circle,
  TrendingUp,
} from "lucide-react";
import { Target, Pencil, Check } from "lucide-react";
// (imports fusionnés ci-dessus)

const LOGO = "/manus-storage/dxhunter-logo_11361b71.png";
const MODES = ["SSB", "CW", "FT8", "FT4", "AM", "FM", "RTTY"];

// Continents pour filtre
const CONTINENTS = ["AF", "AN", "AS", "EU", "NA", "OC", "SA"];
const CONTINENT_LABELS: Record<string, string> = {
  AF: "Afrique", AN: "Antarctique", AS: "Asie", EU: "Europe",
  NA: "Amérique N.", OC: "Océanie", SA: "Amérique S.",
};

// Couleur par continent
const CONTINENT_COLORS: Record<string, string> = {
  AF: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  AN: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  AS: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  EU: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  NA: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  OC: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  SA: "text-pink-400 bg-pink-500/10 border-pink-500/30",
};

// Construire un index DXCC code → entity
const DXCC_BY_CODE = new Map(DXCC_ENTITIES.map((e) => [e.code, e]));

export default function DxccTracker() {
  const visitorId = useVisitorId();

  // Objectif DXCC personnalisé
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.get.useQuery(
    { visitorId },
    { enabled: !!visitorId }
  );
  const setGoalMutation = trpc.settings.setDxccGoal.useMutation({
    onSuccess: () => refetchSettings(),
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const dxccGoal = settingsData?.dxccGoal ?? 100;

  const [filterBand, setFilterBand] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>("");
  const [filterContinent, setFilterContinent] = useState<string>("");
  const [showWorkedOnly, setShowWorkedOnly] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [search, setSearch] = useState("");

  // Récupérer les DXCC travaillés depuis le logbook
  const { data: workedData, isLoading } = trpc.dxcc.getWorked.useQuery(
    { visitorId, band: filterBand || undefined, mode: filterMode || undefined },
    { enabled: !!visitorId }
  );

  // Construire un Set des codes DXCC travaillés (avec bande/mode si filtrés)
  const workedSet = useMemo(() => {
    if (!workedData) return new Set<string>();
    return new Set(workedData.map((w) => w.dxccCode));
  }, [workedData]);

  // Construire la map code → liste de {band, mode, dxCall, workedAt}
  const workedDetails = useMemo(() => {
    const map = new Map<string, typeof workedData>();
    if (!workedData) return map;
    for (const w of workedData) {
      if (!map.has(w.dxccCode)) map.set(w.dxccCode, []);
      map.get(w.dxccCode)!.push(w);
    }
    return map;
  }, [workedData]);

  // Filtrer les entités DXCC
  const filteredEntities = useMemo(() => {
    return DXCC_ENTITIES.filter((e) => {
      const worked = workedSet.has(e.code);
      if (showWorkedOnly && !worked) return false;
      if (showMissingOnly && worked) return false;
      if (filterContinent && e.continent !== filterContinent) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [workedSet, showWorkedOnly, showMissingOnly, filterContinent, search]);

  // Stats
  const stats = useMemo(() => {
    const total = DXCC_ENTITIES.length;
    const worked = workedSet.size;
    const pct = total > 0 ? Math.round((worked / total) * 100) : 0;
    // Par continent
    const byCont: Record<string, { total: number; worked: number }> = {};
    for (const e of DXCC_ENTITIES) {
      if (!byCont[e.continent]) byCont[e.continent] = { total: 0, worked: 0 };
      byCont[e.continent].total++;
      if (workedSet.has(e.code)) byCont[e.continent].worked++;
    }
    return { total, worked, pct, byCont };
  }, [workedSet]);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const selectedDetails = selectedCode ? workedDetails.get(selectedCode) : null;
  const selectedEntity = selectedCode ? DXCC_BY_CODE.get(selectedCode) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-[oklch(0.16_0.009_250)]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/app" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={LOGO} alt="DX Hunter" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-mono text-base font-extrabold tracking-tight text-foreground leading-none">
              DXCC TRACKER
            </h1>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {stats.worked} / {stats.total} entités DXCC travaillées · {stats.pct}%
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Stats rapides */}
            <div className="hidden sm:flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-400">{stats.worked}</span>
              <span className="text-[10px] text-muted-foreground uppercase">DXCC</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded border border-border px-3 py-1.5">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-bold text-foreground">{stats.total}</span>
              <span className="text-[10px] text-muted-foreground uppercase">Total</span>
            </div>
            {/* Lien Logbook */}
            <Link
              href="/logbook"
              className="flex items-center gap-1.5 rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold text-violet-400 hover:bg-violet-500/20 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logbook</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Barre de progression globale */}
      <div className="border-b border-border bg-card/30 px-3 py-2 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums w-12 text-right">
            {stats.pct}%
          </span>
        </div>
        {/* Barre de progression vers l'objectif */}
        <div className="mt-2 flex items-center gap-3">
          <Target className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
              style={{ width: `${Math.min((stats.worked / dxccGoal) * 100, 100)}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {stats.worked}/{dxccGoal}
          </span>
          {editingGoal ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min={1} max={340}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="w-14 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                autoFocus
              />
              <button
                onClick={() => {
                  const v = parseInt(goalInput, 10);
                  if (v >= 1 && v <= 340 && visitorId) {
                    setGoalMutation.mutate({ visitorId, dxccGoal: v });
                  }
                  setEditingGoal(false);
                }}
                className="rounded border border-emerald-500/40 bg-emerald-500/10 p-0.5 text-emerald-400 hover:bg-emerald-500/20"
              >
                <Check className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setGoalInput(String(dxccGoal)); setEditingGoal(true); }}
              className="flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-2.5 w-2.5" />
              Objectif
            </button>
          )}
        </div>
        {/* Stats par continent */}
        <div className="mt-2 flex flex-wrap gap-2">
          {CONTINENTS.map((cont) => {
            const s = stats.byCont[cont];
            if (!s) return null;
            const pct = s.total > 0 ? Math.round((s.worked / s.total) * 100) : 0;
            return (
              <button
                key={cont}
                onClick={() => setFilterContinent(filterContinent === cont ? "" : cont)}
                className={cn(
                  "flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold transition-all",
                  filterContinent === cont
                    ? CONTINENT_COLORS[cont] + " ring-1 ring-current/50"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{cont}</span>
                <span className="opacity-70">{s.worked}/{s.total}</span>
                <span className="opacity-50">({pct}%)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtres */}
      <div className="border-b border-border bg-card/20 px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {/* Recherche */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher DXCC..."
            className="rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground placeholder-muted-foreground focus:border-primary/60 focus:outline-none w-36"
          />
          {/* Bande */}
          <select
            value={filterBand}
            onChange={(e) => setFilterBand(e.target.value)}
            className="rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground focus:border-primary/60 focus:outline-none"
          >
            <option value="">Toutes bandes</option>
            {TRACKED_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {/* Mode */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground focus:border-primary/60 focus:outline-none"
          >
            <option value="">Tous modes</option>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {/* Travaillés / Manquants */}
          <button
            onClick={() => { setShowWorkedOnly(!showWorkedOnly); setShowMissingOnly(false); }}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all border",
              showWorkedOnly
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle2 className="h-3 w-3" /> Travaillés
          </button>
          <button
            onClick={() => { setShowMissingOnly(!showMissingOnly); setShowWorkedOnly(false); }}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all border",
              showMissingOnly
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Circle className="h-3 w-3" /> Manquants
          </button>
          {/* Effacer */}
          {(filterBand || filterMode || filterContinent || search || showWorkedOnly || showMissingOnly) && (
            <button
              onClick={() => { setFilterBand(""); setFilterMode(""); setFilterContinent(""); setSearch(""); setShowWorkedOnly(false); setShowMissingOnly(false); }}
              className="flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Effacer
            </button>
          )}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {filteredEntities.length} entité{filteredEntities.length > 1 ? "s" : ""} affichée{filteredEntities.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Grille des entités */}
        <div className="flex-1 p-3 sm:p-4 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground font-mono text-sm">
              Chargement...
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Globe className="h-12 w-12 text-muted-foreground/30" />
              <p className="font-mono text-sm text-muted-foreground">Aucune entité DXCC trouvée</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredEntities.map((entity) => {
                const worked = workedSet.has(entity.code);
                const details = workedDetails.get(entity.code) || [];
                const isSelected = selectedCode === entity.code;
                return (
                  <button
                    key={entity.code}
                    onClick={() => setSelectedCode(isSelected ? null : entity.code)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-mono font-bold transition-all",
                      "hover:scale-[1.03] active:scale-[0.97]",
                      worked
                        ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/50"
                        : cn(CONTINENT_COLORS[entity.continent] || "bg-muted text-muted-foreground border-border"),
                      isSelected && "ring-2 ring-primary shadow-lg shadow-primary/20"
                    )}
                    title={`${entity.name} (${entity.code}) — ${entity.continent}`}
                  >
                    {worked ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 shrink-0 opacity-40" />
                    )}
                    <span className={worked ? "line-through opacity-70" : ""}>{entity.code}</span>
                    {details.length > 0 && (
                      <span className="text-[9px] opacity-60">({details.length})</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panneau de détail */}
        {selectedCode && selectedEntity && (
          <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card/50 p-4 overflow-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-mono text-lg font-extrabold text-primary">{selectedEntity.code}</div>
                <div className="font-mono text-sm text-foreground">{selectedEntity.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {selectedEntity.continent} · CQ {selectedEntity.cqZone} · ITU {selectedEntity.ituZone}
                </div>
              </div>
              <button onClick={() => setSelectedCode(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!selectedDetails || selectedDetails.length === 0 ? (
              <div className="rounded border border-border bg-background/30 p-3 text-center">
                <Circle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-mono text-xs text-muted-foreground">Non travaillé</p>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  Enregistrez un QSO dans le logbook pour suivre cette entité
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {selectedDetails.length} QSO enregistré{selectedDetails.length > 1 ? "s" : ""}
                  </span>
                </div>
                {selectedDetails.map((d, i) => (
                  <div
                    key={i}
                    className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-primary">{d.dxCall}</span>
                      <span className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-bold text-primary">
                        {d.band}
                      </span>
                      <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] font-bold text-muted-foreground">
                        {d.mode}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {new Date(d.workedAt).toISOString().slice(0, 16).replace("T", " ")}z
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
