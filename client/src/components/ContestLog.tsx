/**
 * ContestLog — Carnet de trafic du contest actif.
 * Inclut un formulaire de saisie rapide, le tableau des QSOs,
 * le score temps réel, et l'export Cabrillo.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpen, Zap, Send, Download, Trash2, AlertTriangle, Globe, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

type ContestId = string;

interface QsoRow {
  id: number;
  call: string;
  band: string;
  mode: string;
  freqKhz: number | null;
  qsoTime: number | null;
  rstSent: string | null;
  rstRcvd: string | null;
  exchangeSent: string | null;
  exchangeRcvd: string | null;
  cqZone: number | null;
  countryPrefix: string | null;
  wpxPrefix: string | null;
  continent: string | null;
  isNewMulti: number | null;
  multiType: string | null;
  multiValue: string | null;
  isRunQso: number | null;
}

/** Colonnes spécifiques par type de contest */
function getColumns(contestId: ContestId | null) {
  const base = [
    { key: "nr", label: "#", width: "w-7" },
    { key: "time", label: "UTC", width: "w-11" },
    { key: "call", label: "Call", width: "w-20" },
    { key: "band", label: "Bde", width: "w-9" },
    { key: "mode", label: "Md", width: "w-9" },
    { key: "rst", label: "RST", width: "w-11" },
  ];

  switch (contestId) {
    case "IOTA":
      return [...base, { key: "exchange", label: "IOTA Ref", width: "w-16" }, { key: "multi", label: "M", width: "w-5" }];
    case "CQWW_SSB":
    case "CQWW_CW":
      return [...base, { key: "exchange", label: "Zone CQ", width: "w-14" }, { key: "country", label: "Pays", width: "w-10" }, { key: "multi", label: "M", width: "w-5" }];
    case "CQWPX_SSB":
    case "CQWPX_CW":
      return [...base, { key: "exchange", label: "Serial", width: "w-14" }, { key: "prefix", label: "Pfx", width: "w-12" }, { key: "multi", label: "M", width: "w-5" }];
    case "IARU_HFC":
      return [...base, { key: "exchange", label: "Zone/HQ", width: "w-14" }, { key: "multi", label: "M", width: "w-5" }];
    case "COUPE_REF":
    case "REF_SSB":
      return [...base, { key: "exchange", label: "Dept", width: "w-12" }, { key: "multi", label: "M", width: "w-5" }];
    default:
      return [...base, { key: "exchange", label: "Échange", width: "w-16" }, { key: "multi", label: "M", width: "w-5" }];
  }
}

/** Placeholder pour l'échange reçu selon le contest */
function getExchangePlaceholder(contestId: string | null): string {
  switch (contestId) {
    case "IOTA": return "EU-005";
    case "CQWW_SSB":
    case "CQWW_CW": return "Zone CQ (14)";
    case "CQWPX_SSB":
    case "CQWPX_CW": return "Serial (001)";
    case "IARU_HFC": return "Zone/HQ";
    case "COUPE_REF":
    case "REF_SSB": return "Dept (75)";
    default: return "Échange";
  }
}

function formatTime(ts: number | null): string {
  if (!ts) return "--:--";
  const d = new Date(ts);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
}

function getCellValue(qso: QsoRow, colKey: string, index: number, totalCount: number): string {
  switch (colKey) {
    case "nr":
      return String(totalCount - index);
    case "time":
      return formatTime(qso.qsoTime);
    case "call":
      return qso.call;
    case "band":
      return qso.band + "m";
    case "mode":
      return qso.mode;
    case "rst":
      return `${qso.rstSent || "59"}/${qso.rstRcvd || "59"}`;
    case "exchange":
      return qso.exchangeRcvd || qso.exchangeSent || "-";
    case "country":
      return qso.countryPrefix || "-";
    case "prefix":
      return qso.wpxPrefix || "-";
    case "multi":
      return qso.isNewMulti ? "★" : "";
    default:
      return "-";
  }
}

/** Points par QSO selon le contest IOTA */
function computeIotaScore(qsos: QsoRow[]): { points: number; mults: number; score: number } {
  let points = 0;
  const multSet = new Set<string>();
  for (const qso of qsos) {
    // IOTA: 15 pts island-to-island, 5 pts island-to-non-island, 3 pts non-island-to-island, 1 pt non-island-to-non-island
    // Simplified: 3 pts if exchange has IOTA ref, 1 pt otherwise
    const hasIota = qso.exchangeRcvd && /^[A-Z]{2}-\d{3}$/i.test(qso.exchangeRcvd.trim());
    points += hasIota ? 3 : 1;
    if (qso.multiType && qso.multiValue) {
      multSet.add(`${qso.band}:${qso.multiType}:${qso.multiValue}`);
    }
  }
  const mults = multSet.size;
  return { points, mults, score: points * mults };
}

/** Points par QSO générique */
function computeGenericScore(qsos: QsoRow[]): { points: number; mults: number; score: number } {
  const multSet = new Set<string>();
  for (const qso of qsos) {
    if (qso.multiType && qso.multiValue) {
      multSet.add(`${qso.band}:${qso.multiType}:${qso.multiValue}`);
    }
  }
  const mults = multSet.size;
  return { points: qsos.length, mults, score: qsos.length * mults };
}

/** Génère un fichier Cabrillo */
function generateCabrillo(
  contestId: string | null,
  qsos: QsoRow[],
  mycall: string,
  category: string,
): string {
  const contestName = contestId === "IOTA" ? "RSGB-IOTA"
    : contestId === "CQWW_SSB" ? "CQ-WW-SSB"
    : contestId === "CQWW_CW" ? "CQ-WW-CW"
    : contestId === "CQWPX_SSB" ? "CQ-WPX-SSB"
    : contestId === "CQWPX_CW" ? "CQ-WPX-CW"
    : contestId === "IARU_HFC" ? "IARU-HF"
    : contestId === "COUPE_REF" || contestId === "REF_SSB" ? "REF-SSB"
    : contestId || "UNKNOWN";

  const catLine = category === "SINGLE_OP" ? "SINGLE-OP ALL HIGH" : "MULTI-ONE ALL HIGH";

  const lines: string[] = [
    "START-OF-LOG: 3.0",
    `CONTEST: ${contestName}`,
    `CALLSIGN: ${mycall}`,
    `CATEGORY-OPERATOR: ${category === "SINGLE_OP" ? "SINGLE-OP" : "MULTI-OP"}`,
    `CATEGORY-BAND: ALL`,
    `CATEGORY-POWER: HIGH`,
    `CATEGORY-MODE: MIXED`,
    `CLAIMED-SCORE: 0`,
    `CLUB: `,
    `LOCATION: `,
    `NAME: `,
    `ADDRESS: `,
    `OPERATORS: ${mycall}`,
    `SOAPBOX: Logged with DX Hunter`,
  ];

  // QSO lines
  for (const qso of [...qsos].reverse()) {
    const d = qso.qsoTime ? new Date(qso.qsoTime) : new Date();
    const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const time = `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
    const freq = qso.freqKhz ? String(Math.round(qso.freqKhz)) : bandToFreq(qso.band, qso.mode);
    const mode = qso.mode === "CW" ? "CW" : qso.mode === "RTTY" ? "RY" : "PH";
    const rstS = qso.rstSent || "59";
    const rstR = qso.rstRcvd || "59";
    const exS = qso.exchangeSent || "001";
    const exR = qso.exchangeRcvd || "";

    lines.push(
      `QSO: ${freq.padStart(5)} ${mode.padEnd(2)} ${date} ${time} ${mycall.padEnd(13)} ${rstS.padEnd(3)} ${exS.padEnd(6)} ${qso.call.padEnd(13)} ${rstR.padEnd(3)} ${exR.padEnd(6)}`,
    );
  }

  lines.push("END-OF-LOG:");
  return lines.join("\n");
}

function bandToFreq(band: string, mode: string): string {
  const freqs: Record<string, Record<string, string>> = {
    "160": { SSB: "1850", CW: "1830" },
    "80": { SSB: "3750", CW: "3530" },
    "40": { SSB: "7080", CW: "7010" },
    "20": { SSB: "14200", CW: "14030" },
    "15": { SSB: "21250", CW: "21030" },
    "10": { SSB: "28500", CW: "28030" },
  };
  return freqs[band]?.[mode] || freqs[band]?.SSB || "14200";
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface Props {
  contestId: string | null;
  mycall?: string;
  category?: string;
}

export function ContestLog({ contestId, mycall = "F4IVV", category = "SINGLE_OP" }: Props) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.contest.listQsos.useQuery(
    { limit: 100 },
    { refetchInterval: 5000 },
  );

  const logMut = trpc.contest.logQso.useMutation({
    onSuccess: (result) => {
      utils.contest.listQsos.invalidate();
      utils.contest.stats.invalidate();
      utils.contest.getWorkedData.invalidate();
      if (result.isDupe) {
        toast.warning(`DUPE — ${callRef.current?.value} déjà travaillé sur cette bande`);
      } else if (result.isNewMulti) {
        toast.success(`★ MULTI ! ${result.multiType}=${result.multiValue} — QSO #${result.serialNr}`);
      } else {
        toast(`QSO #${result.serialNr} logué`);
      }
      // Reset form
      if (callRef.current) callRef.current.value = "";
      if (exchRef.current) exchRef.current.value = "";
      callRef.current?.focus();
    },
    onError: (err) => {
      toast.error(`Erreur: ${err.message}`);
    },
  });

  const deleteMut = trpc.contest.deleteQso.useMutation({
    onSuccess: () => {
      utils.contest.listQsos.invalidate();
      utils.contest.stats.invalidate();
      utils.contest.getWorkedData.invalidate();
      toast.info("QSO supprimé");
    },
  });

  // Form state
  const [band, setBand] = useState("20");
  const [mode, setMode] = useState("SSB");
  const [rstSent, setRstSent] = useState("59");
  const [rstRcvd, setRstRcvd] = useState("59");
  const [callInput, setCallInput] = useState("");
  const [showScp, setShowScp] = useState(false);
  const [selectedScpIdx, setSelectedScpIdx] = useState(0);
  const callRef = useRef<HTMLInputElement>(null);
  const exchRef = useRef<HTMLInputElement>(null);

  // SCP auto-completion
  const { data: scpData } = trpc.contest.scp.useQuery(
    { partial: callInput },
    { enabled: callInput.length >= 2, staleTime: 10000 },
  );
  const scpMatches = scpData?.matches || [];

  // QRZ lookup (triggered when call has 3+ chars and no typing for 600ms)
  const [qrzCall, setQrzCall] = useState("");
  const { data: qrzData } = trpc.contest.qrzLookup.useQuery(
    { call: qrzCall },
    { enabled: qrzCall.length >= 3, staleTime: 60000 },
  );
  const qrzInfo = qrzData?.info || null;

  // Debounce QRZ lookup
  const qrzTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (callInput.length >= 3) {
      clearTimeout(qrzTimer.current);
      qrzTimer.current = setTimeout(() => setQrzCall(callInput.toUpperCase()), 600);
    } else {
      setQrzCall("");
    }
    return () => clearTimeout(qrzTimer.current);
  }, [callInput]);

  // Focus call field on mount
  useEffect(() => {
    callRef.current?.focus();
  }, []);

  // Reset SCP index when matches change
  useEffect(() => {
    setSelectedScpIdx(0);
  }, [scpMatches.length]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const call = callRef.current?.value?.trim().toUpperCase();
    if (!call) {
      toast.error("Indicatif requis");
      callRef.current?.focus();
      return;
    }
    const exchangeRcvd = exchRef.current?.value?.trim() || undefined;
    logMut.mutate({
      call,
      band,
      mode,
      rstSent,
      rstRcvd,
      exchangeRcvd,
    });
  }, [band, mode, rstSent, rstRcvd, logMut]);

  // Handle keyboard in call field (SCP navigation + Tab to accept)
  const handleCallKeyDown = (e: React.KeyboardEvent) => {
    if (showScp && scpMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedScpIdx((i) => Math.min(i + 1, scpMatches.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedScpIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" && scpMatches[selectedScpIdx]) {
        e.preventDefault();
        const selected = scpMatches[selectedScpIdx];
        setCallInput(selected);
        if (callRef.current) callRef.current.value = selected;
        setShowScp(false);
        exchRef.current?.focus();
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showScp && scpMatches[selectedScpIdx]) {
        const selected = scpMatches[selectedScpIdx];
        setCallInput(selected);
        if (callRef.current) callRef.current.value = selected;
        setShowScp(false);
        exchRef.current?.focus();
      } else {
        exchRef.current?.focus();
      }
    }
    if (e.key === "Escape") {
      setShowScp(false);
    }
  };

  // Handle Enter key in exchange field → submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Select SCP match
  const selectScpMatch = (call: string) => {
    setCallInput(call);
    if (callRef.current) callRef.current.value = call;
    setShowScp(false);
    exchRef.current?.focus();
  };

  const handleExportCabrillo = () => {
    if (!data?.qsos?.length) {
      toast.error("Aucun QSO à exporter");
      return;
    }
    const content = generateCabrillo(contestId, data.qsos as QsoRow[], mycall, category);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mycall}_${contestId || "contest"}.cbr`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fichier Cabrillo téléchargé");
  };

  const columns = getColumns(contestId || data?.contestId || null);
  const qsos = (data?.qsos || []) as QsoRow[];

  // Score
  const scoreData = contestId === "IOTA" ? computeIotaScore(qsos) : computeGenericScore(qsos);

  const bands = ["160", "80", "40", "20", "15", "10"];

  return (
    <div className="space-y-2">
      {/* ─── Formulaire de saisie rapide ─── */}
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          {/* Call with SCP autocomplete */}
          <div className="relative flex-1 min-w-0">
            <input
              ref={callRef}
              placeholder="CALL"
              value={callInput}
              onChange={(e) => {
                setCallInput(e.target.value.toUpperCase());
                setShowScp(e.target.value.length >= 2);
              }}
              onFocus={() => callInput.length >= 2 && setShowScp(true)}
              onBlur={() => setTimeout(() => setShowScp(false), 200)}
              onKeyDown={handleCallKeyDown}
              className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs font-mono font-bold text-foreground uppercase placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary focus:border-primary"
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
                      "w-full text-left px-2 py-0.5 text-[11px] font-mono transition-colors",
                      i === selectedScpIdx ? "bg-primary/20 text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Exchange */}
          <input
            ref={exchRef}
            placeholder={getExchangePlaceholder(contestId)}
            onKeyDown={handleKeyDown}
            className="w-20 rounded border border-border bg-card px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary focus:border-primary"
          />
          {/* Submit */}
          <button
            type="submit"
            disabled={logMut.isPending}
            className="flex items-center gap-1 rounded bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            Log
          </button>
        </div>

        {/* QRZ info bar */}
        {qrzInfo && (
          <div className="flex items-center gap-2 rounded bg-muted/50 border border-border px-2 py-1 text-[10px]">
            <Globe className="h-3 w-3 text-primary shrink-0" />
            <span className="font-mono font-bold text-foreground">{qrzInfo.call}</span>
            {qrzInfo.fname && <span className="text-muted-foreground">{qrzInfo.fname} {qrzInfo.name}</span>}
            {qrzInfo.country && <span className="text-amber-400">{qrzInfo.country}</span>}
            {qrzInfo.city && <span className="text-muted-foreground"><MapPin className="inline h-2.5 w-2.5" /> {qrzInfo.city}</span>}
            {qrzInfo.grid && <span className="text-primary/80 font-mono">{qrzInfo.grid}</span>}
            {qrzInfo.iota && <span className="text-emerald-400 font-bold">{qrzInfo.iota}</span>}
            {qrzInfo.cqzone && <span className="text-muted-foreground">CQ:{qrzInfo.cqzone}</span>}
          </div>
        )}

        {/* Bande / Mode / RST */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className="rounded border border-border bg-card px-1.5 py-1 text-[10px] text-foreground"
          >
            {bands.map((b) => (
              <option key={b} value={b}>{b}m</option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded border border-border bg-card px-1.5 py-1 text-[10px] text-foreground"
          >
            <option value="SSB">SSB</option>
            <option value="CW">CW</option>
            <option value="RTTY">RTTY</option>
            <option value="FT8">FT8</option>
          </select>
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <span>S:</span>
            <input
              value={rstSent}
              onChange={(e) => setRstSent(e.target.value)}
              className="w-8 rounded border border-border bg-card px-1 py-0.5 text-[10px] font-mono text-foreground text-center"
            />
            <span>R:</span>
            <input
              value={rstRcvd}
              onChange={(e) => setRstRcvd(e.target.value)}
              className="w-8 rounded border border-border bg-card px-1 py-0.5 text-[10px] font-mono text-foreground text-center"
            />
          </div>

          {/* Score compact */}
          <div className="ml-auto flex items-center gap-2 text-[10px] font-mono">
            <span className="text-foreground font-bold">{scoreData.points}pts</span>
            <span className="text-amber-400">×{scoreData.mults}M</span>
            <span className="text-primary font-bold">={scoreData.score.toLocaleString()}</span>
          </div>
        </div>
      </form>

      {/* ─── Tableau des QSOs ─── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : qsos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
          <BookOpen className="h-5 w-5 opacity-50" />
          <p className="text-[10px]">Carnet vide — saisis ton premier QSO ci-dessus</p>
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded border border-border/50 bg-card/30">
          <table className="w-full text-[9px] font-mono">
            <thead className="sticky top-0 bg-card/95 border-b border-border/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-1 py-1 text-left text-muted-foreground font-medium uppercase tracking-wider",
                      col.width,
                    )}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-5 px-0.5 py-1" />
              </tr>
            </thead>
            <tbody>
              {qsos.map((qso, i) => (
                <tr
                  key={qso.id}
                  className={cn(
                    "border-b border-border/20 transition-colors hover:bg-card/50 group",
                    qso.isNewMulti && "bg-amber-500/5",
                    i === 0 && "bg-primary/5",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-1 py-0.5",
                        col.key === "call" && "font-bold text-foreground",
                        col.key === "multi" && qso.isNewMulti && "text-amber-400",
                        col.key === "band" && "text-primary/80",
                        col.key !== "call" && col.key !== "multi" && col.key !== "band" && "text-foreground/70",
                      )}
                    >
                      {col.key === "multi" && qso.isNewMulti ? (
                        <Zap className="h-3 w-3 text-amber-400" />
                      ) : (
                        getCellValue(qso, col.key, i, qsos.length)
                      )}
                    </td>
                  ))}
                  <td className="px-0.5 py-0.5">
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le QSO avec ${qso.call} ?`)) {
                          deleteMut.mutate({ id: qso.id });
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Footer : export Cabrillo ─── */}
      {qsos.length > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-[9px] text-muted-foreground">
            {qsos.length} QSO{qsos.length > 1 ? "s" : ""} · Score: {scoreData.score.toLocaleString()}
          </span>
          <button
            onClick={handleExportCabrillo}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[9px] font-medium text-foreground/80 transition-all hover:border-primary/50 hover:text-primary active:scale-95"
          >
            <Download className="h-3 w-3" />
            Cabrillo
          </button>
        </div>
      )}
    </div>
  );
}
