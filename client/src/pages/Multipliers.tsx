/**
 * Page Multiplicateurs — Suivi des multiplicateurs par concours.
 * Onglets : CQ WPX, CQ WW, IARU HFC (TM0HQ), Coupe du REF.
 * Chaque multiplicateur est cliquable pour voir les stations correspondantes.
 * Fonctions : cochage "travaillé", alerte nouveau mult, export ADIF.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpots } from "@/hooks/useSpots";
import { Spot, TRACKED_BANDS, utcClock, displayMode } from "@/lib/dx";
import { ituZoneFromLatLon, hqFromCallsign, looksLikeHQ } from "@/lib/multipliers";
import {
  CONTESTS,
  ContestId,
  ContestMultipliers,
  SpotMultiplier,
  extractWpxMultipliers,
  extractCqWwMultipliers,
  extractIaruMultipliers,
  extractRefMultipliers,
} from "@shared/contestMultipliers";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { playBeep, unlockAudio } from "@/lib/beep";
import { toast } from "sonner";
import {
  Radio,
  ArrowLeft,
  Trophy,
  Check,
  CheckCircle2,
  ExternalLink,
  Hash,
  Globe,
  MapPin,
  Flag,
  Layers,
  Volume2,
  VolumeX,
  Download,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";

const LOGO = "/manus-storage/dxhunter-logo_11361b71.png";

// ---------------------------------------------------------------------------
// localStorage helpers for "worked" mults
// ---------------------------------------------------------------------------
const WORKED_KEY = "dxh_worked_mults";

function loadWorked(): Record<string, Set<string>> {
  try {
    const raw = localStorage.getItem(WORKED_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, string[]>;
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = new Set(v);
    }
    return result;
  } catch {
    return {};
  }
}

function saveWorked(data: Record<string, Set<string>>) {
  const obj: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(data)) {
    obj[k] = Array.from(v);
  }
  localStorage.setItem(WORKED_KEY, JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// ADIF export helper
// ---------------------------------------------------------------------------
function generateAdif(
  mults: SpotMultiplier[],
  spots: Spot[],
  contestName: string
): string {
  const lines: string[] = [];
  lines.push("ADIF Export from DX Hunter");
  lines.push(`Contest: ${contestName}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("<EOH>");
  lines.push("");

  for (const m of mults) {
    for (const call of m.calls) {
      const spot = spots.find(
        (s) => s.dx_call === call && (!m.band || s.band === m.band)
      );
      if (!spot) continue;

      const freqMhz = (spot.freq / 1000000).toFixed(6);
      const mode = displayMode(spot.mode, spot.freq / 1000);
      const band = spot.band || "";
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const timeStr = now.toISOString().slice(11, 15).replace(/:/g, "");

      let record = "";
      record += `<CALL:${call.length}>${call}`;
      record += `<FREQ:${freqMhz.length}>${freqMhz}`;
      record += `<MODE:${mode.length}>${mode}`;
      record += `<BAND:${band.length}>${band}`;
      record += `<QSO_DATE:${dateStr.length}>${dateStr}`;
      record += `<TIME_ON:${timeStr.length}>${timeStr}`;
      if (spot.dx_country) {
        record += `<COUNTRY:${spot.dx_country.length}>${spot.dx_country}`;
      }
      record += `<COMMENT:${m.label.length}>${m.label}`;
      record += "<EOR>";
      lines.push(record);
    }
  }

  return lines.join("\n");
}

function downloadAdif(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function multIcon(type: string) {
  switch (type) {
    case "prefix":
      return <Hash className="h-3.5 w-3.5" />;
    case "cq_zone":
    case "itu_zone":
      return <Globe className="h-3.5 w-3.5" />;
    case "country":
      return <Flag className="h-3.5 w-3.5" />;
    case "hq_station":
      return <Radio className="h-3.5 w-3.5" />;
    case "department":
    case "domtom":
      return <MapPin className="h-3.5 w-3.5" />;
    default:
      return <Layers className="h-3.5 w-3.5" />;
  }
}

function multColor(type: string, worked: boolean): string {
  if (worked) {
    return "bg-emerald-500/25 text-emerald-200 border-emerald-400/60";
  }
  switch (type) {
    case "prefix":
      return "bg-violet-500/20 text-violet-300 border-violet-500/40";
    case "cq_zone":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    case "itu_zone":
      return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    case "country":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "hq_station":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "department":
      return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "domtom":
      return "bg-pink-500/20 text-pink-300 border-pink-500/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const BAND_TAG_COLORS: Record<string, string> = {
  "160m": "bg-violet-500/30 text-violet-200",
  "80m": "bg-blue-500/30 text-blue-200",
  "40m": "bg-cyan-500/30 text-cyan-200",
  "20m": "bg-yellow-500/30 text-yellow-200",
  "15m": "bg-orange-500/30 text-orange-200",
  "10m": "bg-pink-500/30 text-pink-200",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Multipliers() {
  const { spots } = useSpots();
  const [activeContest, setActiveContest] = useState<ContestId>("CQ_WPX");
  const [selectedMult, setSelectedMult] = useState<SpotMultiplier | null>(null);
  const [bandFilter, setBandFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [clock, setClock] = useState(utcClock());

  // Worked mults state (persisted in localStorage)
  const [workedMap, setWorkedMap] = useState<Record<string, Set<string>>>(() => loadWorked());

  const workedSet = useMemo(() => workedMap[activeContest] || new Set<string>(), [workedMap, activeContest]);

  const toggleWorked = useCallback(
    (multId: string) => {
      setWorkedMap((prev) => {
        const next = { ...prev };
        const set = new Set(next[activeContest] || []);
        if (set.has(multId)) {
          set.delete(multId);
        } else {
          set.add(multId);
        }
        next[activeContest] = set;
        saveWorked(next);
        return next;
      });
    },
    [activeContest]
  );

  const resetWorked = useCallback(() => {
    setWorkedMap((prev) => {
      const next = { ...prev };
      delete next[activeContest];
      saveWorked(next);
      return next;
    });
  }, [activeContest]);

  useEffect(() => {
    const t = setInterval(() => setClock(utcClock()), 1000);
    return () => clearInterval(t);
  }, []);

  // Extraire les multiplicateurs du concours actif
  const contestData = useMemo<ContestMultipliers>(() => {
    switch (activeContest) {
      case "CQ_WPX":
        return extractWpxMultipliers(spots);
      case "CQ_WW":
        return extractCqWwMultipliers(spots);
      case "IARU_HFC":
        return extractIaruMultipliers(spots, ituZoneFromLatLon, hqFromCallsign, looksLikeHQ);
      case "COUPE_REF":
        return extractRefMultipliers(spots);
      default:
        return { contestId: activeContest, multipliers: [], totalUnique: 0 };
    }
  }, [spots, activeContest]);

  // ---- Alerte nouveau multiplicateur ----
  const prevMultIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const currentIds = new Set(contestData.multipliers.map((m) => m.id));

    if (firstLoad.current) {
      prevMultIds.current = currentIds;
      firstLoad.current = false;
      return;
    }

    if (!alertOn) {
      prevMultIds.current = currentIds;
      return;
    }

    const newMults: SpotMultiplier[] = [];
    for (const m of contestData.multipliers) {
      if (!prevMultIds.current.has(m.id)) {
        newMults.push(m);
      }
    }

    if (newMults.length > 0) {
      playBeep("mult");
      for (const m of newMults.slice(0, 3)) {
        toast(`Nouveau mult : ${m.label}`, {
          description: `${m.type.replace("_", " ")}${m.band ? ` · ${m.band}` : ""} · ${m.calls[0] || ""}`,
          icon: <Trophy className="h-4 w-4 text-amber-400" />,
        });
      }
      if (newMults.length > 3) {
        toast(`+${newMults.length - 3} autres nouveaux multiplicateurs`);
      }
    }

    prevMultIds.current = currentIds;
  }, [contestData, alertOn]);

  // Reset alert tracking when contest changes
  useEffect(() => {
    prevMultIds.current = new Set(contestData.multipliers.map((m) => m.id));
  }, [activeContest]);

  // Filtrer par bande, type, et manquants
  const filteredMults = useMemo(() => {
    let mults = contestData.multipliers;
    if (bandFilter) {
      mults = mults.filter((m) => m.band === bandFilter);
    }
    if (typeFilter) {
      mults = mults.filter((m) => m.type === typeFilter);
    }
    if (showMissingOnly) {
      mults = mults.filter((m) => !workedSet.has(m.id));
    }
    return mults;
  }, [contestData, bandFilter, typeFilter, showMissingOnly, workedSet]);

  // Bandes disponibles
  const availableBands = useMemo(() => {
    const bands = new Set<string>();
    for (const m of contestData.multipliers) {
      if (m.band) bands.add(m.band);
    }
    return Array.from(bands).sort((a, b) => {
      const order = ["160m", "80m", "40m", "20m", "15m", "10m"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [contestData]);

  // Types disponibles
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const m of contestData.multipliers) types.add(m.type);
    return Array.from(types);
  }, [contestData]);

  // Statistiques
  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    for (const m of filteredMults) {
      byType.set(m.type, (byType.get(m.type) || 0) + 1);
    }
    const workedCount = filteredMults.filter((m) => workedSet.has(m.id)).length;
    return {
      total: filteredMults.length,
      worked: workedCount,
      missing: filteredMults.length - workedCount,
      byType: Array.from(byType.entries()),
      totalSpots: filteredMults.reduce((acc, m) => acc + m.spotCount, 0),
      pct: filteredMults.length > 0 ? Math.round((workedCount / filteredMults.length) * 100) : 0,
    };
  }, [filteredMults, workedSet]);

  const contestMeta = CONTESTS.find((c) => c.id === activeContest)!;

  // Réinitialiser la sélection quand on change de concours
  useEffect(() => {
    setSelectedMult(null);
    setBandFilter(null);
    setTypeFilter(null);
    setShowMissingOnly(false);
  }, [activeContest]);

  // Export ADIF
  const handleExportAdif = () => {
    const adif = generateAdif(filteredMults, spots, contestMeta.name);
    const filename = `dxhunter_${activeContest.toLowerCase()}_mults_${new Date().toISOString().slice(0, 10)}.adi`;
    downloadAdif(adif, filename);
    toast("Export ADIF téléchargé", {
      description: `${filteredMults.length} multiplicateurs exportés`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-[oklch(0.16_0.009_250)]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={LOGO} alt="DX Hunter" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-mono text-base font-extrabold tracking-tight text-foreground leading-none">
              MULTIPLICATEURS
            </h1>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              Suivi en temps réel par concours
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Barre de progression travaillés */}
            <div className="hidden sm:flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-400">{stats.worked}</span>
              <span className="text-[10px] text-muted-foreground">/</span>
              <span className="font-mono text-sm text-muted-foreground">{stats.total}</span>
              <span className="text-[10px] text-emerald-400 font-bold">{stats.pct}%</span>
            </div>
            {/* Compteur manquants */}
            <div className="hidden sm:flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="font-mono text-sm font-bold text-amber-400">{stats.missing}</span>
              <span className="text-[10px] text-muted-foreground uppercase">manquants</span>
            </div>
            {/* Alerte son */}
            <button
              onClick={() => {
                unlockAudio();
                setAlertOn(!alertOn);
              }}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold uppercase transition-all",
                alertOn
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {alertOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{alertOn ? "Alerte ON" : "Alerte OFF"}</span>
            </button>
            {/* Export ADIF */}
            <button
              onClick={handleExportAdif}
              className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ADIF</span>
            </button>
            {/* Horloge */}
            <div className="rounded border border-border bg-card px-2.5 py-1 text-right">
              <div className="font-mono text-sm font-bold leading-none text-primary tabular-nums">{clock}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">UTC</div>
            </div>
          </div>
        </div>
      </header>

      {/* Onglets concours */}
      <div className="border-b border-border bg-card/50">
        <div className="flex gap-0 overflow-x-auto px-2 sm:px-4">
          {CONTESTS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveContest(c.id)}
              className={cn(
                "relative px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                "hover:text-foreground",
                activeContest === c.id
                  ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                  : "text-muted-foreground"
              )}
            >
              {c.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Description du concours + filtres */}
      <div className="border-b border-border bg-card/30 px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-sm font-bold text-foreground">{contestMeta.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{contestMeta.description}</span>
          </div>

          {/* Filtre manquants */}
          <button
            onClick={() => setShowMissingOnly(!showMissingOnly)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
              showMissingOnly
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {showMissingOnly ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            Manquants
          </button>

          {/* Reset travaillés */}
          {workedSet.size > 0 && (
            <button
              onClick={() => {
                if (confirm(`Réinitialiser les ${workedSet.size} multiplicateurs travaillés pour ${contestMeta.shortName} ?`)) {
                  resetWorked();
                }
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive transition-all"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}

          {/* Filtre par bande */}
          {contestMeta.multPerBand && availableBands.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase mr-1">Bande:</span>
              <button
                onClick={() => setBandFilter(null)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                  !bandFilter
                    ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Toutes
              </button>
              {availableBands.map((b) => (
                <button
                  key={b}
                  onClick={() => setBandFilter(bandFilter === b ? null : b)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                    bandFilter === b
                      ? "ring-1 ring-primary/50 " + (BAND_TAG_COLORS[b] || "bg-muted text-foreground")
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Filtre par type */}
          {availableTypes.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase mr-1">Type:</span>
              <button
                onClick={() => setTypeFilter(null)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                  !typeFilter
                    ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tous
              </button>
              {availableTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1",
                    typeFilter === t
                      ? "ring-1 ring-primary/50 bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {multIcon(t)}
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Barre de progression visuelle */}
        {stats.total > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums w-12 text-right">
              {stats.pct}%
            </span>
          </div>
        )}
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Grille des multiplicateurs */}
        <div className="flex-1 p-3 sm:p-4 overflow-auto">
          {filteredMults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Trophy className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-mono text-sm">
                {showMissingOnly ? "Tous les multiplicateurs sont travaillés !" : "Aucun multiplicateur détecté"}
              </p>
              <p className="text-xs mt-1">
                {showMissingOnly
                  ? "Désactivez le filtre 'Manquants' pour voir tous les mults."
                  : "Les spots en direct n'ont pas encore révélé de multiplicateurs pour ce concours."}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredMults.map((m) => {
                const isWorked = workedSet.has(m.id);
                return (
                  <div key={m.id} className="relative group">
                    <button
                      onClick={() => setSelectedMult(selectedMult?.id === m.id ? null : m)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-mono font-bold transition-all",
                        "hover:scale-[1.03] active:scale-[0.97]",
                        multColor(m.type, isWorked),
                        isWorked && "opacity-70",
                        selectedMult?.id === m.id && "ring-2 ring-primary shadow-lg shadow-primary/20"
                      )}
                    >
                      {isWorked ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        multIcon(m.type)
                      )}
                      <span className={isWorked ? "line-through" : ""}>{m.label}</span>
                      {m.band && (
                        <span className={cn("text-[9px] px-1 rounded", BAND_TAG_COLORS[m.band] || "bg-muted")}>
                          {m.band}
                        </span>
                      )}
                      <span className="text-[9px] opacity-60">({m.spotCount})</span>
                    </button>
                    {/* Bouton cocher/décocher travaillé */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWorked(m.id);
                      }}
                      className={cn(
                        "absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                        "opacity-0 group-hover:opacity-100",
                        isWorked
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "bg-card border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-400"
                      )}
                      title={isWorked ? "Marquer comme non travaillé" : "Marquer comme travaillé"}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Résumé par type */}
          {stats.byType.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3">
              {stats.byType.map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {multIcon(type)}
                  <span className="capitalize">{type.replace("_", " ")}</span>
                  <span className="font-bold text-foreground">{count}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold text-emerald-400">{stats.worked}</span>
                <span>travaillés</span>
                <span className="mx-1">·</span>
                <span className="font-bold text-amber-400">{stats.missing}</span>
                <span>manquants</span>
              </div>
            </div>
          )}
        </div>

        {/* Panneau détail du multiplicateur sélectionné */}
        {selectedMult && (
          <div className="lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/50 p-3 sm:p-4 overflow-auto max-h-[50vh] lg:max-h-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {workedSet.has(selectedMult.id) ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  multIcon(selectedMult.type)
                )}
                <h3 className="font-mono text-sm font-bold text-foreground">{selectedMult.label}</h3>
                {selectedMult.band && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", BAND_TAG_COLORS[selectedMult.band] || "bg-muted")}>
                    {selectedMult.band}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleWorked(selectedMult.id)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase transition-all",
                    workedSet.has(selectedMult.id)
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-muted text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 border border-border"
                  )}
                >
                  <Check className="h-3 w-3" />
                  {workedSet.has(selectedMult.id) ? "Travaillé" : "Cocher"}
                </button>
                <button
                  onClick={() => setSelectedMult(null)}
                  className="text-muted-foreground hover:text-foreground text-xs ml-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground uppercase mb-2">
              {selectedMult.spotCount} spot{selectedMult.spotCount > 1 ? "s" : ""} · {selectedMult.calls.length} station{selectedMult.calls.length > 1 ? "s" : ""} unique{selectedMult.calls.length > 1 ? "s" : ""}
            </div>

            {/* Liste des stations */}
            <div className="space-y-1">
              {selectedMult.calls.map((call) => {
                const spot = spots.find((s) => s.dx_call === call && (!selectedMult.band || s.band === selectedMult.band));
                return (
                  <div
                    key={call}
                    className="flex items-center gap-2 rounded border border-border bg-background/50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-mono font-bold text-primary flex-1">{call}</span>
                    {spot && (
                      <>
                        {spot.dx_flag && <span className="text-sm">{spot.dx_flag}</span>}
                        {spot.dx_country && (
                          <span className="text-muted-foreground truncate max-w-[120px]">{spot.dx_country}</span>
                        )}
                        {spot.band && (
                          <span className={cn("text-[9px] px-1 rounded font-bold", BAND_TAG_COLORS[spot.band] || "bg-muted")}>
                            {spot.band}
                          </span>
                        )}
                        <span className="text-muted-foreground tabular-nums">
                          {(spot.freq / 1000).toFixed(1)}
                        </span>
                        {spot.mode && (
                          <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground font-bold">
                            {displayMode(spot.mode, spot.freq / 1000)}
                          </span>
                        )}
                      </>
                    )}
                    <a
                      href={`https://www.qrz.com/db/${call}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary/60 hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
