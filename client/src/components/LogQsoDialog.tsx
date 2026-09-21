/**
 * LogQsoDialog — Dialog de log QSO enrichi.
 * Pré-remplit les données du spot (indicatif, fréquence, bande, mode, pays).
 * Intègre : lookup QRZ (nom, pays, QTH, locator, IOTA, zone CQ),
 *           SCP auto-complétion (si l'indicatif est modifié manuellement),

 * RST par défaut : 59 (SSB) ou 599 (CW/FT8).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Spot } from "@/lib/dx";
import { toast } from "sonner";
import { Check, X, BookOpen, Globe, MapPin, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Retourne la date/heure UTC au format "YYYY-MM-DDTHH:mm" pour un input datetime-local */
function nowUtcStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 16);
}

function defaultRst(mode: string): string {
  const m = (mode || "").toUpperCase();
  if (["CW", "RTTY", "FT8", "FT4"].includes(m)) return "599";
  return "59";
}

interface Props {
  spot: Spot;
  visitorId: string;
  onConfirm: (dxCall: string, band?: string) => void;
  onCancel: () => void;

}

export function LogQsoDialog({ spot, visitorId, onConfirm, onCancel }: Props) {
  const mode = spot.mode || (spot.family === "CW" ? "CW" : "SSB");
  const rst = defaultRst(mode);
  const [rstSent, setRstSent] = useState(rst);
  const [rstRcvd, setRstRcvd] = useState(rst);
  const [notes, setNotes] = useState("");
  const [operatorName, setOperatorName] = useState("");

  const [dxCall, setDxCall] = useState(spot.dx_call);
  const [qsoDateUtc, setQsoDateUtc] = useState(nowUtcStr);

  // SCP auto-completion (only when user modifies the call)
  const [showScp, setShowScp] = useState(false);
  const [selectedScpIdx, setSelectedScpIdx] = useState(0);
  const callRef = useRef<HTMLInputElement>(null);
  const exchRef = useRef<HTMLInputElement>(null);

  const { data: scpData } = trpc.contest.scp.useQuery(
    { partial: dxCall },
    { enabled: dxCall.length >= 2, staleTime: 10000 },
  );
  const scpMatches = scpData?.matches || [];

  // QRZ lookup (debounced)
  const [qrzCall, setQrzCall] = useState(spot.dx_call);
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

  // Debounce QRZ lookup when call changes
  const qrzTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (dxCall.length >= 3) {
      clearTimeout(qrzTimer.current);
      qrzTimer.current = setTimeout(() => setQrzCall(dxCall.toUpperCase()), 500);
    } else {
      setQrzCall("");
    }
    return () => clearTimeout(qrzTimer.current);
  }, [dxCall]);

  // Reset SCP index when matches change
  useEffect(() => {
    setSelectedScpIdx(0);
  }, [scpMatches.length]);

  const utils = trpc.useUtils();

  const addMutation = trpc.logbook.add.useMutation({
    onSuccess: (data) => {
      const dxcc = data.dxccCode ? ` · DXCC: ${data.dxccCode}` : "";
      toast.success(`QSO enregistré : ${dxCall}${dxcc}`, {
        icon: <BookOpen className="h-4 w-4" />,
      });
      utils.logbook.list.invalidate();
      utils.logbook.stats.invalidate();
    },
    onError: (e) => {
      toast.error(`Erreur logbook : ${e.message}`);
    },
  });



  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const call = dxCall.trim().toUpperCase();
    if (!call) return;

    // Log dans le logbook quotidien
    addMutation.mutate({
      visitorId,
      dxCall: call,
      freqKhz: spot.freqKhz,
      band: spot.band || "?",
      mode,
      dxCountry: qrzInfo?.country || spot.dx_country || undefined,
      dxccCode: qrzInfo?.dxcc ? String(qrzInfo.dxcc) : undefined,
      rstSent,
      rstRcvd,
      operatorName: operatorName || undefined,
      notes: notes || undefined,
      qsoDateUtc: new Date(qsoDateUtc + "Z").toISOString(),
    });



    onConfirm(call, spot.band || undefined);
  }, [dxCall, spot, mode, rstSent, rstRcvd, notes, operatorName, qrzInfo, visitorId]);

  function handleSkip() {
    onConfirm(spot.dx_call, spot.band || undefined);
  }

  // SCP keyboard navigation
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
        setDxCall(selected);
        setShowScp(false);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showScp && scpMatches[selectedScpIdx]) {
        setDxCall(scpMatches[selectedScpIdx]);
        setShowScp(false);
      } else {
        handleSubmit();
      }
    }
    if (e.key === "Escape") {
      setShowScp(false);
    }
  };

  const selectScpMatch = (call: string) => {
    setDxCall(call);
    setShowScp(false);
  };

  const inputCls =
    "w-full rounded border border-border bg-background px-2.5 py-1.5 font-mono text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";
  const labelCls = "block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1";

  const isPending = addMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-lg rounded-xl border border-primary/30 bg-card p-5 shadow-2xl mx-4">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-mono text-base font-extrabold text-primary">
              QSO — {dxCall}
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
              {spot.freqKhz.toFixed(1)} kHz · {spot.band} · {mode}
              {spot.dx_country ? ` · ${spot.dx_country}` : ""}
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
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

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-3">
          {/* Indicatif (modifiable + SCP) */}
          <div className="relative">
            <label className={labelCls}>Indicatif DX</label>
            <input
              ref={callRef}
              className={cn(inputCls, "font-bold uppercase")}
              value={dxCall}
              onChange={(e) => {
                setDxCall(e.target.value.toUpperCase());
                setShowScp(e.target.value.length >= 2);
              }}
              onFocus={() => dxCall.length >= 2 && setShowScp(true)}
              onBlur={() => setTimeout(() => setShowScp(false), 200)}
              onKeyDown={handleCallKeyDown}
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

          {/* Date/Heure UTC */}
          <div>
            <label className={labelCls}><Clock className="inline h-3 w-3 mr-1" />Date / Heure UTC</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={qsoDateUtc}
              onChange={(e) => setQsoDateUtc(e.target.value)}
            />
          </div>

          {/* RST + Nom opérateur */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>RST Envoyé</label>
              <input
                className={inputCls}
                value={rstSent}
                onChange={(e) => setRstSent(e.target.value)}
                placeholder={rst}
              />
            </div>
            <div>
              <label className={labelCls}>RST Reçu</label>
              <input
                className={inputCls}
                value={rstRcvd}
                onChange={(e) => setRstRcvd(e.target.value)}
                placeholder={rst}
              />
            </div>
            <div>
              <label className={labelCls}>Nom opérateur</label>
              <input
                className={inputCls}
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder={qrzInfo?.fname || "Nom"}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optionnel)</label>
            <input
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, QTH, etc."
            />
          </div>



          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 rounded border border-border py-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              FAIT sans log
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded border border-primary/50 bg-primary/10 py-2 font-mono text-xs font-bold text-primary hover:bg-primary/20 transition-colors",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              <Check className="h-4 w-4" />
              {isPending ? "Enregistrement..." : "FAIT + Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
