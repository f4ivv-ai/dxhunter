/**
 * RunModeLog — Formulaire de log inline "mode Run".
 *
 * Reste ouvert en permanence quand l'opérateur est calé sur une fréquence.
 * Pré-remplit freq/mode depuis l'état CAT du rig.
 * Aide à l'identification :
 *   - Spots actifs sur la fréquence courante (±2 kHz) → suggestions cliquables
 *   - Direction antenne (azimut rotor) affichée pour orienter l'opérateur
 *   - Auto-complétion SCP sur le champ indicatif
 *   - Lookup QRZ automatique (pays, nom, QTH)
 * Date/heure UTC enregistrée au moment de la validation (pas éditable).
 * Après validation le formulaire se vide et reste ouvert pour le QSO suivant.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Spot } from "@/lib/dx";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BookOpen, Globe, MapPin, Search, Clock,
  Radio, Navigation, Zap, Check, X, Crosshair,
} from "lucide-react";

interface Props {
  /** Fréquence actuelle du rig (MHz, ex: 7.185) */
  currentFreqMhz: number;
  /** Mode actuel du rig */
  currentMode: string;
  /** Tous les spots actifs (pour matcher la fréquence) */
  spots: Spot[];
  /** Azimut actuel du rotor (si disponible) */
  rotorAzimuth?: number;
  /** Latitude de l'opérateur */
  userLat?: number;
  /** Longitude de l'opérateur */
  userLon?: number;
  /** Visitor ID pour le logbook */
  visitorId: string;

  /** Callback après log réussi (pour marquer comme worked) */
  onLogged?: (dxCall: string, band?: string) => void;
  /** Indicatif pré-rempli depuis un QSY (spot cliqué) */
  prefillCall?: string;
  /** Azimut du DX cible (calculé depuis les coords du spot) */
  dxBearing?: number;
  /** Pays du DX cible */
  dxCountry?: string;
}

function freqToBand(freqKhz: number): string {
  if (freqKhz >= 1800 && freqKhz < 2000) return "160m";
  if (freqKhz >= 3500 && freqKhz < 4000) return "80m";
  if (freqKhz >= 5300 && freqKhz < 5410) return "60m";
  if (freqKhz >= 7000 && freqKhz < 7300) return "40m";
  if (freqKhz >= 10100 && freqKhz < 10150) return "30m";
  if (freqKhz >= 14000 && freqKhz < 14350) return "20m";
  if (freqKhz >= 18068 && freqKhz < 18168) return "17m";
  if (freqKhz >= 21000 && freqKhz < 21450) return "15m";
  if (freqKhz >= 24890 && freqKhz < 24990) return "12m";
  if (freqKhz >= 28000 && freqKhz < 29700) return "10m";
  if (freqKhz >= 50000 && freqKhz < 54000) return "6m";
  return "?";
}

function defaultRst(mode: string): string {
  const m = (mode || "").toUpperCase();
  if (["CW", "RTTY", "FT8", "FT4"].includes(m)) return "599";
  return "59";
}

export function RunModeLog({
  currentFreqMhz,
  currentMode,
  spots,
  rotorAzimuth,
  userLat,
  userLon,
  visitorId,
  onLogged,
  prefillCall,
  dxBearing,
  dxCountry,
}: Props) {
  const freqKhz = currentFreqMhz * 1000;
  const band = freqToBand(freqKhz);
  const mode = currentMode || "SSB";
  const rst = defaultRst(mode);

  const [dxCall, setDxCall] = useState("");
  const [rstSent, setRstSent] = useState(rst);
  const [rstRcvd, setRstRcvd] = useState(rst);
  const [notes, setNotes] = useState("");

  const [showScp, setShowScp] = useState(false);
  const [selectedScpIdx, setSelectedScpIdx] = useState(0);
  const callRef = useRef<HTMLInputElement>(null);

  // Reset RST when mode changes
  useEffect(() => {
    const newRst = defaultRst(mode);
    setRstSent(newRst);
    setRstRcvd(newRst);
  }, [mode]);

  // Pré-remplir l'indicatif depuis un QSY (spot cliqué)
  useEffect(() => {
    if (prefillCall && prefillCall !== dxCall) {
      setDxCall(prefillCall);
      setShowScp(false);
      callRef.current?.focus();
    }
  }, [prefillCall]);

  // ─── Spots sur la fréquence courante (±2 kHz) ───
  const nearbySpots = useMemo(() => {
    if (freqKhz <= 0) return [];
    return spots.filter(s => Math.abs(s.freqKhz - freqKhz) <= 2);
  }, [spots, freqKhz]);

  // ─── SCP auto-completion ───
  const { data: scpData } = trpc.contest.scp.useQuery(
    { partial: dxCall },
    { enabled: dxCall.length >= 2, staleTime: 10000 },
  );
  const scpMatches = scpData?.matches || [];

  // ─── QRZ lookup (debounced) ───
  const [qrzCall, setQrzCall] = useState("");
  const { data: qrzData, isLoading: qrzLoading } = trpc.contest.qrzLookup.useQuery(
    { call: qrzCall },
    { enabled: qrzCall.length >= 3, staleTime: 60000 },
  );
  const qrzInfo = qrzData?.info || null;

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

  useEffect(() => {
    setSelectedScpIdx(0);
  }, [scpMatches.length]);

  // ─── Historique de contacts (déjà travaillé ?) ───
  const { data: historyData } = trpc.logbook.history.useQuery(
    { visitorId, dxCall: dxCall.toUpperCase().trim() },
    { enabled: dxCall.trim().length >= 3, staleTime: 30000 },
  );

  // ─── Mutations ───
  const utils = trpc.useUtils();

  const addMutation = trpc.logbook.add.useMutation({
    onSuccess: (data) => {
      const dxcc = data.dxccCode ? ` · DXCC: ${data.dxccCode}` : "";
      toast.success(`QSO logué : ${dxCall.toUpperCase()}${dxcc}`, {
        icon: <BookOpen className="h-4 w-4" />,
      });
      utils.logbook.list.invalidate();
      utils.logbook.stats.invalidate();
    },
    onError: (e) => {
      toast.error(`Erreur logbook : ${e.message}`);
    },
  });



  // ─── Submit ───
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const call = dxCall.trim().toUpperCase();
    if (!call) {
      callRef.current?.focus();
      return;
    }

    // Horodatage UTC au moment de la validation
    const qsoDateUtc = new Date().toISOString();

    addMutation.mutate({
      visitorId,
      dxCall: call,
      freqKhz,
      band,
      mode,
      dxCountry: qrzInfo?.country || undefined,
      dxccCode: qrzInfo?.dxcc ? String(qrzInfo.dxcc) : undefined,
      rstSent,
      rstRcvd,
      operatorName: qrzInfo ? [qrzInfo.fname, qrzInfo.name].filter(Boolean).join(" ") : undefined,
      notes: notes || undefined,
      qsoDateUtc,
    });



    onLogged?.(call, band);

    // Reset pour le QSO suivant (freq/mode restent)
    setDxCall("");
    setNotes("");
    setQrzCall("");
    setShowScp(false);
    // Remettre le focus sur le champ indicatif
    setTimeout(() => callRef.current?.focus(), 50);
  }, [dxCall, freqKhz, band, mode, rstSent, rstRcvd, notes, qrzInfo, visitorId, onLogged]);

  // ─── SCP keyboard navigation ───
  const handleCallKeyDown = (e: React.KeyboardEvent) => {
    if (showScp && scpMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedScpIdx(i => Math.min(i + 1, scpMatches.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedScpIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" && scpMatches[selectedScpIdx]) {
        e.preventDefault();
        setDxCall(scpMatches[selectedScpIdx]);
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
    callRef.current?.focus();
  };

  const selectNearbySpot = (spot: Spot) => {
    setDxCall(spot.dx_call);
    setShowScp(false);
  };

  const inputCls =
    "w-full rounded border border-border bg-background px-2.5 py-1.5 font-mono text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";
  const labelCls = "block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5";

  const isPending = addMutation.isPending;

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-emerald-400" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
          Mode Run — Log rapide
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          <Clock className="inline h-3 w-3 mr-0.5" />
          Heure enregistrée à la validation
        </span>
      </div>

      {/* Info fréquence/mode/bande */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 rounded bg-card border border-border px-2 py-1">
          <Radio className="h-3 w-3 text-primary" />
          <span className="font-mono text-sm font-bold text-primary tabular-nums">
            {currentFreqMhz.toFixed(3)} MHz
          </span>
        </div>
        <span className="rounded bg-card border border-border px-2 py-1 font-mono text-xs font-bold text-foreground">
          {mode}
        </span>
        <span className="rounded bg-card border border-border px-2 py-1 font-mono text-xs text-muted-foreground">
          {band}
        </span>
        {/* Azimut antenne (rotor) */}
        {rotorAzimuth !== undefined && (
          <div className="flex items-center gap-1 rounded bg-card border border-amber-500/40 px-2 py-1">
            <Navigation className="h-3 w-3 text-amber-400" style={{ transform: `rotate(${rotorAzimuth}deg)` }} />
            <span className="font-mono text-xs text-amber-400 font-bold">ANT {rotorAzimuth}°</span>
          </div>
        )}
        {/* Azimut du DX cible */}
        {dxBearing !== undefined && (
          <div className="flex items-center gap-1 rounded bg-card border border-sky-500/40 px-2 py-1">
            <Crosshair className="h-3 w-3 text-sky-400" />
            <span className="font-mono text-xs text-sky-400 font-bold">DX {Math.round(dxBearing)}°</span>
            {dxCountry && <span className="text-[10px] text-muted-foreground">{dxCountry}</span>}
          </div>
        )}
        {/* Écart antenne vs DX */}
        {rotorAzimuth !== undefined && dxBearing !== undefined && (
          <div className={cn(
            "rounded border px-2 py-1 font-mono text-[10px] font-bold",
            Math.abs(((rotorAzimuth - dxBearing + 540) % 360) - 180) <= 15
              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              : "border-red-500/40 text-red-400 bg-red-500/10"
          )}>
            Δ {Math.round(((rotorAzimuth - dxBearing + 540) % 360) - 180)}°
          </div>
        )}
      </div>

      {/* Spots sur cette fréquence (aide à l'identification) */}
      {nearbySpots.length > 0 && (
        <div className="mb-2 rounded border border-primary/20 bg-primary/5 px-2.5 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary/80 mr-2">
            Sur cette fréquence :
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {nearbySpots.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectNearbySpot(s)}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] font-bold transition-all active:scale-[0.95]",
                  dxCall === s.dx_call
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                )}
                title={`${s.dx_country || ""} · ${s.freqKhz.toFixed(1)} kHz · ${s.mode || ""} · ${s.comment || ""}`}
              >
                {s.dx_flag && <span className="mr-1">{s.dx_flag}</span>}
                {s.dx_call}
                {s.dx_country && (
                  <span className="ml-1 text-[9px] text-muted-foreground font-normal">{s.dx_country}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QRZ info bar */}
      {qrzInfo && (
        <div className="flex items-center gap-2 flex-wrap rounded bg-muted/50 border border-border px-2.5 py-1.5 mb-2 text-[11px]">
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
        <div className="flex items-center gap-2 rounded bg-muted/30 border border-border px-2.5 py-1 mb-2 text-[10px] text-muted-foreground">
          <Search className="h-3 w-3 animate-pulse" />
          Recherche QRZ...
        </div>
      )}

      {/* Historique de contacts */}
      {dxCall.trim().length >= 3 && historyData && (
        <div className={cn(
          "flex items-center gap-2 flex-wrap rounded border px-2.5 py-1.5 mb-2 text-[11px]",
          historyData.count === 0
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-orange-500/40 bg-orange-500/10"
        )}>
          {historyData.count === 0 ? (
            <>
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400">NEW !</span>
              <span className="text-muted-foreground">Jamais contacté</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-mono font-bold text-orange-400">
                DÉJÀ TRAVAILLÉ ({historyData.count}x)
              </span>
              <span className="text-muted-foreground">—</span>
              {historyData.summary.map(s => (
                <span key={s.band} className="rounded bg-card border border-border px-1.5 py-0.5 font-mono text-[10px]">
                  <span className="text-primary font-bold">{s.band}</span>
                  <span className="text-muted-foreground ml-1">{s.modes.join("/")}</span>
                </span>
              ))}
              {historyData.contacts[0] && (
                <span className="text-muted-foreground text-[10px]">
                  Dernier : {new Date(historyData.contacts[0].date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  {" "}{new Date(historyData.contacts[0].date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_80px_80px_auto]">
          {/* Indicatif (avec SCP) */}
          <div className="relative">
            <label className={labelCls}>Indicatif DX</label>
            <input
              ref={callRef}
              className={cn(inputCls, "font-bold uppercase text-base")}
              value={dxCall}
              onChange={(e) => {
                setDxCall(e.target.value.toUpperCase());
                setShowScp(e.target.value.length >= 2);
              }}
              onFocus={() => dxCall.length >= 2 && setShowScp(true)}
              onBlur={() => setTimeout(() => setShowScp(false), 200)}
              onKeyDown={handleCallKeyDown}
              placeholder="INDICATIF"
              autoComplete="off"
            />
            {/* SCP dropdown */}
            {showScp && scpMatches.length > 0 && (
              <div className="absolute z-50 top-full left-0 mt-0.5 w-full max-h-28 overflow-y-auto rounded border border-border bg-card shadow-lg">
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

          {/* RST envoyé */}
          <div>
            <label className={labelCls}>RST TX</label>
            <input
              className={inputCls}
              value={rstSent}
              onChange={(e) => setRstSent(e.target.value)}
            />
          </div>

          {/* RST reçu */}
          <div>
            <label className={labelCls}>RST RX</label>
            <input
              className={inputCls}
              value={rstRcvd}
              onChange={(e) => setRstRcvd(e.target.value)}
            />
          </div>

          {/* Bouton LOG */}
          <div>
            <label className={labelCls}>&nbsp;</label>
            <button
              type="submit"
              disabled={isPending || !dxCall.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 rounded border border-emerald-500/50 bg-emerald-500/10 px-4 py-1.5 font-mono text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-[0.97]",
                (isPending || !dxCall.trim()) && "opacity-40 cursor-not-allowed"
              )}
            >
              <Check className="h-4 w-4" />
              LOG
            </button>
          </div>
        </div>

        {/* Ligne secondaire : notes */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className={labelCls}>Notes (optionnel)</label>
            <input
              className={cn(inputCls, "text-xs")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, QTH..."
            />
          </div>


        </div>
      </form>
    </div>
  );
}
