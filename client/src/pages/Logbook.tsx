/**
 * Page Logbook — Journal de trafic QSO.
 * Tableau des QSO enregistrés, saisie manuelle, export ADIF compatible QRZ.com.
 * v2 : dates européennes, drapeaux, couleurs bandes/mois, tri colonnes, recherche, filtre période.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useVisitorId } from "@/hooks/useVisitorId";
import { TRACKED_BANDS, BAND_COLORS } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, Download, Plus, Trash2, X,
  Radio, Globe, BarChart3, Upload, Search, ChevronUp, ChevronDown, ChevronsUpDown, Calendar, MapPin,
} from "lucide-react";
import { countryToFlag } from "../../../shared/countryMeta";
import { findDxccByCallsign, findDxccByCountryName } from "../../../shared/dxccEntities";

const LOGO = "/manus-storage/dxhunter-logo_11361b71.png";
const MODES = ["SSB", "CW", "FT8", "FT4", "AM", "FM", "RTTY", "PSK31"];

/** Couleurs par mois (0=Jan … 11=Dec) */
const MONTH_COLORS: string[] = [
  "#4da6ff", // Jan — bleu
  "#6366f1", // Fév — indigo
  "#00d4d4", // Mar — cyan
  "#22c55e", // Avr — vert
  "#84cc16", // Mai — vert-jaune
  "#f5c842", // Jun — jaune doré
  "#ff9f1a", // Jul — orange
  "#ff5577", // Aoû — rose-rouge
  "#f97316", // Sep — orange vif
  "#b07aff", // Oct — violet
  "#06b6d4", // Nov — cyan foncé
  "#ff44ff", // Déc — magenta
];

const MONTH_NAMES_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function defaultRst(mode: string): string {
  if (["CW","RTTY","FT8","FT4"].includes(mode.toUpperCase())) return "599";
  return "59";
}

function freqToBand(freqKhz: number): string {
  if (freqKhz >= 1800 && freqKhz <= 2000) return "160m";
  if (freqKhz >= 3500 && freqKhz <= 4000) return "80m";
  if (freqKhz >= 7000 && freqKhz <= 7300) return "40m";
  if (freqKhz >= 10100 && freqKhz <= 10150) return "30m";
  if (freqKhz >= 14000 && freqKhz <= 14350) return "20m";
  if (freqKhz >= 18068 && freqKhz <= 18168) return "17m";
  if (freqKhz >= 21000 && freqKhz <= 21450) return "15m";
  if (freqKhz >= 24890 && freqKhz <= 24990) return "12m";
  if (freqKhz >= 28000 && freqKhz <= 29700) return "10m";
  if (freqKhz >= 50000 && freqKhz <= 54000) return "6m";
  if (freqKhz >= 144000 && freqKhz <= 148000) return "2m";
  return "";
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

/** Formate une date en format européen : JJ/MM/AAAA HH:MM UTC */
function formatDateEu(d: Date | string): { day: string; month: string; year: string; time: string; monthIdx: number } {
  const dt = new Date(d);
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const monthIdx = dt.getUTCMonth();
  const month = MONTH_NAMES_FR[monthIdx];
  const year = String(dt.getUTCFullYear());
  const time = `${String(dt.getUTCHours()).padStart(2,"0")}:${String(dt.getUTCMinutes()).padStart(2,"0")}`;
  return { day, month, year, time, monthIdx };
}

/** Dérive le drapeau emoji depuis le code DXCC ou le pays */
function getFlag(dxccCode: string | null, dxCall: string, dxCountry?: string | null): string {
  const entity = findDxccByCallsign(dxCall);
  // Utiliser le champ isoCode de l'entité DXCC (couverture complète des 340 entités)
  if (entity?.isoCode) {
    try { return countryToFlag(entity.isoCode); } catch { /* ignore */ }
  }
  // Fallback : chercher par nom de pays DXCC (pour les QSO importés)
  if (dxCountry) {
    const entityByName = findDxccByCountryName(dxCountry);
    if (entityByName?.isoCode) {
      try { return countryToFlag(entityByName.isoCode); } catch { /* ignore */ }
    }
  }
  // Fallback : utiliser dxccCode si c'est un code ISO 2 lettres valide
  const fallback = dxccCode ?? "";
  if (fallback.length === 2 && /^[A-Z]{2}$/.test(fallback)) {
    try { return countryToFlag(fallback); } catch { /* ignore */ }
  }
  return "🏳️";
}

// ─── Composant badge bande coloré ────────────────────────────────────────────
function BandBadge({ band }: { band: string }) {
  const color = BAND_COLORS[band] ?? "#888";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {band}
    </span>
  );
}

// ─── Composant badge mode ─────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = {
    SSB: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    CW: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    FT8: "text-purple-400 bg-purple-500/15 border-purple-500/30",
    FT4: "text-violet-400 bg-violet-500/15 border-violet-500/30",
    AM: "text-orange-400 bg-orange-500/15 border-orange-500/30",
    FM: "text-green-400 bg-green-500/15 border-green-500/30",
    RTTY: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  };
  const cls = colors[mode.toUpperCase()] ?? "text-muted-foreground bg-muted/30 border-border";
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold", cls)}>
      {mode}
    </span>
  );
}

// ─── Composant date colorée par mois ─────────────────────────────────────────
function DateCell({ date }: { date: Date | string }) {
  const { day, month, year, time, monthIdx } = formatDateEu(date);
  const color = MONTH_COLORS[monthIdx];
  return (
    <div className="flex flex-col leading-tight">
      <div className="flex items-baseline gap-0.5 font-mono text-[11px]">
        <span className="font-bold text-foreground">{day}</span>
        <span className="font-bold" style={{ color }}>{month}</span>
        <span className="text-muted-foreground/70">{year}</span>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{time} UTC</span>
    </div>
  );
}

// ─── Icône de tri ─────────────────────────────────────────────────────────────
type SortBy = "date" | "call" | "band" | "mode" | "freq";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (sortBy !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />;
}

// ─── Formulaire de saisie manuelle ───────────────────────────────────────────
interface AddQsoFormProps {
  visitorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddQsoForm({ visitorId, onSuccess, onCancel }: AddQsoFormProps) {
  const [dxCall, setDxCall] = useState("");
  const [freqKhz, setFreqKhz] = useState("");
  const [mode, setMode] = useState("SSB");
  const [rstSent, setRstSent] = useState("59");
  const [rstRcvd, setRstRcvd] = useState("59");
  const [notes, setNotes] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [qsoDate, setQsoDate] = useState(() => new Date().toISOString().slice(0, 16));

  // SCP auto-completion
  const [showScp, setShowScp] = useState(false);
  const [selectedScpIdx, setSelectedScpIdx] = useState(0);
  const callRef = useRef<HTMLInputElement>(null);

  const { data: scpData } = trpc.contest.scp.useQuery(
    { partial: dxCall },
    { enabled: dxCall.length >= 2, staleTime: 10000 },
  );
  const scpMatches = scpData?.matches || [];

  // QRZ lookup (debounced)
  const [qrzCall, setQrzCall] = useState("");
  const { data: qrzData, isLoading: qrzLoading } = trpc.contest.qrzLookup.useQuery(
    { call: qrzCall },
    { enabled: qrzCall.length >= 3, staleTime: 60000 },
  );
  const qrzInfo = qrzData?.info || null;

  // Pre-fill operator name from QRZ
  useEffect(() => {
    if (qrzInfo && !operatorName) {
      const name = [qrzInfo.fname, qrzInfo.name].filter(Boolean).join(" ");
      if (name) setOperatorName(name);
    }
  }, [qrzInfo]);

  // Debounce QRZ lookup
  const qrzTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (dxCall.length >= 3) {
      clearTimeout(qrzTimer.current);
      qrzTimer.current = setTimeout(() => setQrzCall(dxCall.toUpperCase()), 600);
    } else {
      setQrzCall("");
    }
    return () => clearTimeout(qrzTimer.current);
  }, [dxCall]);

  // Reset SCP index
  useEffect(() => { setSelectedScpIdx(0); }, [scpMatches.length]);

  const band = useMemo(() => freqToBand(parseFloat(freqKhz) || 0), [freqKhz]);

  const addMutation = trpc.logbook.add.useMutation({
    onSuccess: () => {
      toast.success(`QSO avec ${dxCall.toUpperCase()} enregistré !`);
      onSuccess();
    },
    onError: (e) => toast.error(`Erreur : ${e.message}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dxCall.trim()) return toast.error("Indicatif requis");
    const freq = parseFloat(freqKhz);
    if (!freq || freq < 100) return toast.error("Fréquence invalide (en kHz)");
    addMutation.mutate({
      visitorId,
      dxCall: dxCall.trim().toUpperCase(),
      freqKhz: freq,
      band: band || freqToBand(freq),
      mode,
      dxCountry: qrzInfo?.country || undefined,
      dxccCode: qrzInfo?.dxcc ? String(qrzInfo.dxcc) : undefined,
      rstSent: rstSent || defaultRst(mode),
      rstRcvd: rstRcvd || defaultRst(mode),
      operatorName: operatorName || undefined,
      notes: notes.trim() || undefined,
      qsoDateUtc: new Date(qsoDate + "Z").toISOString(),
    });
  }

  // SCP keyboard navigation
  const handleCallKeyDown = (e: React.KeyboardEvent) => {
    if (showScp && scpMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedScpIdx((i) => Math.min(i + 1, scpMatches.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedScpIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" && scpMatches[selectedScpIdx]) {
        e.preventDefault();
        setDxCall(scpMatches[selectedScpIdx]);
        setShowScp(false);
        return;
      }
    }
    if (e.key === "Enter" && showScp && scpMatches[selectedScpIdx]) {
      e.preventDefault();
      setDxCall(scpMatches[selectedScpIdx]);
      setShowScp(false);
    }
    if (e.key === "Escape") setShowScp(false);
  };

  const selectScpMatch = (call: string) => {
    setDxCall(call);
    setShowScp(false);
  };

  const inputCls = "w-full rounded border border-border bg-card/80 px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelCls = "block mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground";

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-primary uppercase tracking-wider">Nouveau QSO</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* QRZ info bar */}
      {qrzInfo && (
        <div className="flex items-center gap-2 flex-wrap rounded bg-muted/50 border border-border px-2.5 py-1.5 mb-3 text-[11px]">
          <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-mono font-bold text-foreground">{qrzInfo.call}</span>
          {qrzInfo.fname && <span className="text-muted-foreground">{qrzInfo.fname} {qrzInfo.name}</span>}
          {qrzInfo.country && <span className="text-amber-400 font-medium">{qrzInfo.country}</span>}
          {qrzInfo.city && <span className="text-muted-foreground"><MapPin className="inline h-2.5 w-2.5" /> {qrzInfo.city}</span>}
          {qrzInfo.grid && <span className="text-primary/80 font-mono">{qrzInfo.grid}</span>}
          {qrzInfo.iota && <span className="text-emerald-400 font-bold">{qrzInfo.iota}</span>}
          {qrzInfo.cqzone && <span className="text-muted-foreground">CQ:{qrzInfo.cqzone}</span>}
        </div>
      )}
      {qrzLoading && (
        <div className="flex items-center gap-2 rounded bg-muted/30 border border-border px-2.5 py-1.5 mb-3 text-[10px] text-muted-foreground">
          <Search className="h-3 w-3 animate-pulse" />
          Recherche QRZ...
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Indicatif avec SCP */}
        <div className="col-span-2 sm:col-span-1 relative">
          <label className={labelCls}>Indicatif DX *</label>
          <input
            ref={callRef}
            className={cn(inputCls, "font-bold uppercase")}
            value={dxCall}
            onChange={(e) => { setDxCall(e.target.value.toUpperCase()); setShowScp(e.target.value.length >= 2); }}
            onFocus={() => dxCall.length >= 2 && setShowScp(true)}
            onBlur={() => setTimeout(() => setShowScp(false), 200)}
            onKeyDown={handleCallKeyDown}
            placeholder="F4IVV"
            autoFocus
          />
          {/* SCP dropdown */}
          {showScp && scpMatches.length > 0 && (
            <div className="absolute z-50 top-full left-0 mt-0.5 w-full max-h-32 overflow-y-auto rounded border border-border bg-card shadow-lg">
              {scpMatches.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectScpMatch(m); }}
                  className={cn(
                    "w-full text-left px-2.5 py-1 text-xs font-mono transition-colors",
                    i === selectedScpIdx ? "bg-primary/20 text-primary" : "text-foreground hover:bg-muted",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Fréquence kHz *</label>
          <input className={inputCls} type="number" step="0.1" value={freqKhz} onChange={(e) => setFreqKhz(e.target.value)} placeholder="14225" />
          {band && <span className="mt-0.5 block font-mono text-[9px]" style={{ color: BAND_COLORS[band] ?? "#888" }}>→ {band}</span>}
        </div>
        <div>
          <label className={labelCls}>Mode</label>
          <select className={inputCls} value={mode} onChange={(e) => { setMode(e.target.value); setRstSent(defaultRst(e.target.value)); setRstRcvd(defaultRst(e.target.value)); }}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>RST Envoyé</label>
          <input className={inputCls} value={rstSent} onChange={(e) => setRstSent(e.target.value)} placeholder="59" />
        </div>
        <div>
          <label className={labelCls}>RST Reçu</label>
          <input className={inputCls} value={rstRcvd} onChange={(e) => setRstRcvd(e.target.value)} placeholder="59" />
        </div>
        <div>
          <label className={labelCls}>Date/Heure UTC</label>
          <input className={inputCls} type="datetime-local" value={qsoDate} onChange={(e) => setQsoDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nom opérateur</label>
          <input className={inputCls} value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder={qrzInfo?.fname || "Nom (pré-rempli QRZ)"} />
        </div>
        <div>
          <label className={labelCls}>Notes (optionnel)</label>
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, etc." />
        </div>
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={addMutation.isPending}
          className="rounded border border-primary/50 bg-primary/10 px-4 py-1.5 font-mono text-xs font-bold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
          {addMutation.isPending ? "Enregistrement..." : "✓ Enregistrer QSO"}
        </button>
      </div>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Logbook() {
  const visitorId = useVisitorId();
  const [showForm, setShowForm] = useState(false);
  const [filterBand, setFilterBand] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const PAGE_SIZE = 200;

  // Debounce search pour éviter trop de requêtes
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeout = useMemo(() => ({ id: 0 }), []);
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout(searchTimeout.id);
    searchTimeout.id = window.setTimeout(() => {
      setDebouncedSearch(val.trim().toUpperCase());
      setPage(0);
    }, 350) as unknown as number;
  }, [searchTimeout]);

  function handleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(0);
  }

  const queryParams = {
    visitorId,
    band: filterBand || undefined,
    mode: filterMode || undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortDir,
  };

  const countParams = {
    visitorId,
    band: filterBand || undefined,
    mode: filterMode || undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data: qsos, isLoading, refetch } = trpc.logbook.list.useQuery(queryParams, { enabled: !!visitorId });
  const { data: countData, refetch: refetchCount } = trpc.logbook.count.useQuery(countParams, { enabled: !!visitorId });
  const totalQso = countData?.total ?? 0;
  // dxccCount vient du serveur (COUNT DISTINCT sur tout le logbook filtré), pas juste la page courante
  const dxccCountTotal = countData?.dxccCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalQso / PAGE_SIZE));

  // Bandes dynamiques : uniquement celles avec des QSO existants
  const { data: distinctBandsData } = trpc.logbook.distinctBands.useQuery({ visitorId }, { enabled: !!visitorId });
  const usedBands = distinctBandsData?.bands ?? [];

  const { data: adifData, refetch: refetchAdif } = trpc.logbook.exportAdif.useQuery({ visitorId }, { enabled: false });
  const [isImporting, setIsImporting] = useState(false);

  async function handleImportAdif(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !visitorId) return;
    e.target.value = "";
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("adifFile", file);
      formData.append("visitorId", visitorId);
      const resp = await fetch("/api/import-adif", { method: "POST", body: formData });
      const data = await resp.json() as { ok: boolean; imported?: number; duplicates?: number; skipped?: number; error?: string };
      if (!data.ok) {
        toast.error(`Erreur import : ${data.error || "Erreur inconnue"}`);
      } else {
        const parts = [`${data.imported ?? 0} QSO importés`];
        if ((data.duplicates ?? 0) > 0) parts.push(`${data.duplicates} doublons ignorés`);
        if ((data.skipped ?? 0) > 0) parts.push(`${data.skipped} invalides`);
        toast.success(`Import ADIF : ${parts.join(", ")}`);
        refetch(); refetchCount(); setPage(0);
      }
    } catch (err) {
      toast.error(`Erreur import : ${String(err)}`);
    } finally {
      setIsImporting(false);
    }
  }

  const deleteMutation = trpc.logbook.delete.useMutation({
    onSuccess: () => { toast.success("QSO supprimé"); refetch(); refetchCount(); },
    onError: (e) => toast.error(`Erreur : ${e.message}`),
  });

  const rebuildDxccMutation = trpc.logbook.rebuildDxcc.useMutation({
    onSuccess: (data) => {
      toast.success(`DXCC recalculés : ${data.fixed} QSO mis à jour sur ${data.total} sans code`);
      refetch(); refetchCount();
    },
    onError: (e) => toast.error(`Erreur recalcul DXCC : ${e.message}`),
  });

  async function handleExportAdif() {
    const result = await refetchAdif();
    if (result.data?.adif) {
      downloadAdif(result.data.adif, `logbook-${new Date().toISOString().slice(0,10)}.adi`);
      toast.success(`${result.data.count} QSO exportés en ADIF`);
    } else {
      toast.error("Aucun QSO à exporter");
    }
  }

  function handleDelete(id: number, call: string) {
    if (!confirm(`Supprimer le QSO avec ${call} ?`)) return;
    deleteMutation.mutate({ visitorId, id });
  }

  const hasFilters = !!(filterBand || filterMode || debouncedSearch || dateFrom || dateTo);

  // dxccCount sur la page courante (pour info dans le footer)
  const dxccCountPage = useMemo(() => {
    if (!qsos) return 0;
    return new Set(qsos.map((q) => q.dxccCode).filter(Boolean)).size;
  }, [qsos]);

  const thCls = "px-3 py-2 font-medium select-none cursor-pointer hover:text-foreground transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-[oklch(0.16_0.009_250)]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/app" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={LOGO} alt="DX Hunter" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-mono text-base font-extrabold tracking-tight text-foreground leading-none">LOGBOOK</h1>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">Journal de trafic QSO — Export ADIF</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2.5 py-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-sm font-bold text-primary">{totalQso.toLocaleString()}</span>
              <span className="text-[9px] text-muted-foreground uppercase">QSO</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-400">{dxccCountTotal}</span>
              <span className="text-[9px] text-muted-foreground uppercase">DXCC</span>
            </div>

            <button onClick={handleExportAdif}
              className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/50 hover:text-primary active:scale-[0.97]">
              <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span>
            </button>
            <label className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-emerald-500/50 hover:text-emerald-400 active:scale-[0.97] cursor-pointer">
              <Upload className="h-3.5 w-3.5" /><span className="hidden sm:inline">{isImporting ? "Import..." : "Import"}</span>
              <input type="file" accept=".adi,.adif" className="hidden" onChange={handleImportAdif} disabled={isImporting} />
            </label>
            <button
              onClick={() => { if (visitorId) rebuildDxccMutation.mutate({ visitorId }); }}
              disabled={rebuildDxccMutation.isPending}
              title="Recalculer les codes DXCC manquants"
              className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-[0.97] disabled:opacity-50">
              <Globe className="h-3.5 w-3.5" /><span className="hidden sm:inline">{rebuildDxccMutation.isPending ? "..." : "DXCC"}</span>
            </button>
            <Link href="/logbook/stats"
              className="flex items-center gap-1.5 rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-[0.97]">
              <BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Stats</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Corps ── */}
      <div className="flex-1 p-3 sm:p-5 max-w-7xl mx-auto w-full">
        {showForm && (
          <AddQsoForm visitorId={visitorId} onSuccess={() => { setShowForm(false); refetch(); refetchCount(); }} onCancel={() => setShowForm(false)} />
        )}

        {/* ── Barre de filtres ── */}
        <div className="mb-3 space-y-2">
          {/* Ligne 1 : recherche + bande + mode + dates */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Recherche indicatif */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Rechercher indicatif…"
                className="rounded border border-border bg-card pl-7 pr-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/20 w-32 sm:w-52 transition-colors"
              />
              {search && (
                <button onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(0); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {/* Bande (dynamique : uniquement les bandes avec des QSO) */}
            <select value={filterBand} onChange={(e) => { setFilterBand(e.target.value); setPage(0); }}
              className="rounded border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary/60 focus:outline-none">
              <option value="">Toutes bandes</option>
              {usedBands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {/* Mode */}
            <select value={filterMode} onChange={(e) => { setFilterMode(e.target.value); setPage(0); }}
              className="rounded border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary/60 focus:outline-none">
              <option value="">Tous modes</option>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {/* Toggle filtre dates */}
            <button onClick={() => setShowDateFilter((v) => !v)}
              className={cn("flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                showDateFilter || dateFrom || dateTo
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-border text-muted-foreground hover:text-foreground")}>
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Période</span>
            </button>
            {/* Nouveau QSO */}
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary/20 active:scale-[0.97]">
              <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Nouveau QSO</span>
            </button>
            {/* Effacer filtres */}
            {hasFilters && (
              <button onClick={() => { setFilterBand(""); setFilterMode(""); setSearch(""); setDebouncedSearch(""); setDateFrom(""); setDateTo(""); setPage(0); setShowDateFilter(false); }}
                className="flex items-center gap-1 rounded border border-border px-2 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3 w-3" /> Effacer
              </button>
            )}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {totalQso.toLocaleString()} QSO
            </span>
          </div>
          {/* Ligne 2 : filtre dates (conditionnel) */}
          {showDateFilter && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider">Du</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                className="rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground focus:border-amber-500/60 focus:outline-none" />
              <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider">Au</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                className="rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground focus:border-amber-500/60 focus:outline-none" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Tableau des QSO ── */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground font-mono text-sm">
              Chargement du logbook…
            </div>
          ) : !qsos || qsos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="font-mono text-sm text-muted-foreground">
                {hasFilters ? "Aucun QSO correspondant aux filtres" : "Aucun QSO enregistré"}
              </p>
              {!hasFilters && (
                <button onClick={() => setShowForm(true)}
                  className="mt-2 flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs font-bold text-primary hover:bg-primary/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Ajouter un QSO
                </button>
              )}
            </div>
          ) : (
            <>
            {/* ── Vue DESKTOP ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[oklch(0.19_0.009_250)] text-left">
                  <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className={thCls} onClick={() => handleSort("date")}>
                      <span className="flex items-center gap-1">Date UTC <SortIcon col="date" sortBy={sortBy} sortDir={sortDir} /></span>
                    </th>
                    <th className={thCls} onClick={() => handleSort("call")}>
                      <span className="flex items-center gap-1">Indicatif <SortIcon col="call" sortBy={sortBy} sortDir={sortDir} /></span>
                    </th>
                    <th className={thCls} onClick={() => handleSort("freq")}>
                      <span className="flex items-center gap-1">Fréq. <SortIcon col="freq" sortBy={sortBy} sortDir={sortDir} /></span>
                    </th>
                    <th className={thCls} onClick={() => handleSort("band")}>
                      <span className="flex items-center gap-1">Bande <SortIcon col="band" sortBy={sortBy} sortDir={sortDir} /></span>
                    </th>
                    <th className={thCls} onClick={() => handleSort("mode")}>
                      <span className="flex items-center gap-1">Mode <SortIcon col="mode" sortBy={sortBy} sortDir={sortDir} /></span>
                    </th>
                    <th className="px-3 py-2 font-medium">Pays / DXCC</th>
                    <th className="px-3 py-2 font-medium">RST S/R</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                    <th className="px-3 py-2 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {qsos.map((qso, i) => (
                    <tr key={qso.id}
                      className={cn("border-b border-border/40 transition-colors hover:bg-primary/5",
                        i % 2 === 0 ? "bg-transparent" : "bg-card/40")}>
                      {/* Date colorée par mois */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <DateCell date={qso.qsoDateUtc} />
                      </td>
                      {/* Indicatif + drapeau */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base leading-none" title={qso.dxCountry ?? ""}>
                            {getFlag(qso.dxccCode, qso.dxCall, qso.dxCountry)}
                          </span>
                          <a href={`https://www.qrz.com/db/${qso.dxCall}`} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-sm font-bold text-primary hover:underline">
                            {qso.dxCall}
                          </a>
                        </div>
                      </td>
                      {/* Fréquence */}
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {qso.freqKhz.toFixed(1)} kHz
                      </td>
                      {/* Bande colorée */}
                      <td className="px-3 py-2">
                        <BandBadge band={qso.band} />
                      </td>
                      {/* Mode coloré */}
                      <td className="px-3 py-2">
                        <ModeBadge mode={qso.mode} />
                      </td>
                      {/* Pays */}
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[160px] truncate">
                        {qso.dxCountry || qso.dxccCode || "—"}
                      </td>
                      {/* RST */}
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-foreground">{qso.rstSent || "—"}</span>
                        <span className="font-mono text-[10px] text-muted-foreground/60"> / </span>
                        <span className="font-mono text-xs text-muted-foreground">{qso.rstRcvd || "—"}</span>
                      </td>
                      {/* Notes */}
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground/70 max-w-[160px] truncate italic">
                        {qso.notes || ""}
                      </td>
                      {/* Supprimer */}
                      <td className="px-3 py-2">
                        <button onClick={() => handleDelete(qso.id, qso.dxCall)}
                          className="text-muted-foreground/30 hover:text-destructive transition-colors" title="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Vue MOBILE : cartes ── */}
            <div className="sm:hidden flex flex-col divide-y divide-border/50">
              {qsos.map((qso) => {
                const { day, month, year, time, monthIdx } = formatDateEu(qso.qsoDateUtc);
                const monthColor = MONTH_COLORS[monthIdx];
                return (
                  <div key={qso.id} className="flex items-start gap-2 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base leading-none">{getFlag(qso.dxccCode, qso.dxCall, qso.dxCountry)}</span>
                        <a href={`https://www.qrz.com/db/${qso.dxCall}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-sm font-bold text-primary hover:underline">{qso.dxCall}</a>
                        <BandBadge band={qso.band} />
                        <ModeBadge mode={qso.mode} />
                        <span className="font-mono text-[9px] text-muted-foreground">{qso.rstSent}/{qso.rstRcvd}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono">
                          <span className="font-bold text-foreground">{day}</span>
                          <span style={{ color: monthColor }} className="font-bold">{month}</span>
                          <span className="opacity-70">{year}</span>
                          <span className="ml-1 opacity-60">{time}z</span>
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate">{qso.dxCountry || qso.dxccCode || "—"}</span>
                        {qso.notes && <span className="italic truncate opacity-70">"{qso.notes}"</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(qso.id, qso.dxCall)}
                      className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalQso > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[10px] text-muted-foreground font-mono">
            <span>{totalQso.toLocaleString()} QSO · {dxccCountTotal} DXCC distincts · {dxccCountPage} sur cette page</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(0)} disabled={page === 0}
                className="rounded border border-border px-2 py-1 hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                «
              </button>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="rounded border border-border px-2.5 py-1 hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                ← Préc.
              </button>
              <span className="rounded border border-border/50 bg-muted/30 px-2.5 py-1">
                Page {page + 1} / {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="rounded border border-border px-2.5 py-1 hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Suiv. →
              </button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                className="rounded border border-border px-2 py-1 hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                »
              </button>
              <button onClick={handleExportAdif}
                className="ml-2 flex items-center gap-1 hover:text-primary transition-colors">
                <Download className="h-3 w-3" /> ADIF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
