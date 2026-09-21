/**
 * So2rBar — Barre SO2R compacte + Filtre Audio.
 *
 * En mode SO2V (2 slices) : MULTI | SWAP | RUN | Filtre Audio
 * En mode Single-Slice (1 slice) : Filtre Audio uniquement (bouton compact)
 *
 * Le bouton Filtre Audio est TOUJOURS visible dès que le bridge est connecté.
 * Il utilise un Popover (même pattern que le RotorWidget).
 */
import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Zap, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function getBand(freqMHz: number): string {
  if (freqMHz >= 1.8 && freqMHz <= 2.0) return "160m";
  if (freqMHz >= 3.5 && freqMHz <= 4.0) return "80m";
  if (freqMHz >= 5.3 && freqMHz <= 5.4) return "60m";
  if (freqMHz >= 7.0 && freqMHz <= 7.3) return "40m";
  if (freqMHz >= 10.1 && freqMHz <= 10.15) return "30m";
  if (freqMHz >= 14.0 && freqMHz <= 14.35) return "20m";
  if (freqMHz >= 18.068 && freqMHz <= 18.168) return "17m";
  if (freqMHz >= 21.0 && freqMHz <= 21.45) return "15m";
  if (freqMHz >= 24.89 && freqMHz <= 24.99) return "12m";
  if (freqMHz >= 28.0 && freqMHz <= 29.7) return "10m";
  if (freqMHz >= 50.0 && freqMHz <= 54.0) return "6m";
  return "?";
}

const FILTER_PRESETS = [
  { id: "dx_open", label: "DX Ouvert", desc: "100–2800 Hz", cat: "SSB" },
  { id: "dx_pileup", label: "DX Pile-up", desc: "200–2600 Hz", cat: "SSB" },
  { id: "dx_weak", label: "DX Faible", desc: "300–2400 Hz", cat: "SSB" },
  { id: "ssb_narrow", label: "SSB Étroit", desc: "300–2200 Hz", cat: "SSB" },
  { id: "qrm_severe", label: "QRM Sévère", desc: "400–2200 Hz", cat: "SSB" },
  { id: "digi_wide", label: "Digital Large", desc: "100–3000 Hz", cat: "DIGI" },
  { id: "cw_comfort", label: "CW Confort", desc: "400–800 Hz", cat: "CW" },
  { id: "cw_contest", label: "CW Contest", desc: "500–700 Hz", cat: "CW" },
];

export function So2rBar() {
  const { data } = trpc.cat.state.useQuery(undefined, {
    refetchInterval: 1500,
    refetchIntervalInBackground: false,
  });

  const commandMutation = trpc.cat.command.useMutation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [eqEnabled, setEqEnabled] = useState(false);
  const [nbEnabled, setNbEnabled] = useState(false);
  const [nrEnabled, setNrEnabled] = useState(false);
  const [anfEnabled, setAnfEnabled] = useState(false);

  // Sync DSP state from server
  useEffect(() => {
    if (data) {
      setEqEnabled(data.eqEnabled ?? false);
      setNbEnabled(data.nbEnabled ?? false);
      setNrEnabled(data.nrEnabled ?? false);
      setAnfEnabled(data.anfEnabled ?? false);
    }
  }, [data?.eqEnabled, data?.nbEnabled, data?.nrEnabled, data?.anfEnabled]);

  const handleSwap = useCallback(() => {
    commandMutation.mutate(
      { action: "swap" },
      { onSuccess: () => toast.success("SWAP ⇄ Rôles inversés") }
    );
  }, [commandMutation]);

  const handlePreset = useCallback((presetId: string) => {
    setActivePreset(presetId);
    commandMutation.mutate(
      { action: "setpreset", preset: presetId, target: "run" },
      { onSuccess: () => toast.success(`Filtre: ${FILTER_PRESETS.find(p => p.id === presetId)?.label}`) }
    );
  }, [commandMutation]);

  const handleToggleEq = useCallback(() => {
    const newVal = !eqEnabled;
    setEqEnabled(newVal);
    commandMutation.mutate(
      { action: "dsp", param: "eq", enabled: newVal },
      { onSuccess: () => toast.success(newVal ? "EQ activé" : "EQ désactivé") }
    );
  }, [eqEnabled, commandMutation]);

  const handleToggleNb = useCallback(() => {
    const newVal = !nbEnabled;
    setNbEnabled(newVal);
    commandMutation.mutate(
      { action: "dsp", param: "nb", enabled: newVal },
      { onSuccess: () => toast.success(newVal ? "NB activé" : "NB désactivé") }
    );
  }, [nbEnabled, commandMutation]);

  const handleToggleNr = useCallback(() => {
    const newVal = !nrEnabled;
    setNrEnabled(newVal);
    commandMutation.mutate(
      { action: "dsp", param: "nr", enabled: newVal },
      { onSuccess: () => toast.success(newVal ? "NR activé" : "NR désactivé") }
    );
  }, [nrEnabled, commandMutation]);

  const handleToggleAnf = useCallback(() => {
    const newVal = !anfEnabled;
    setAnfEnabled(newVal);
    commandMutation.mutate(
      { action: "dsp", param: "anf", enabled: newVal },
      { onSuccess: () => toast.success(newVal ? "ANF activé" : "ANF désactivé") }
    );
  }, [anfEnabled, commandMutation]);

  // Keyboard shortcut: Ctrl+Tab for SWAP (only in SO2R mode)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (data?.so2r && e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        handleSwap();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSwap, data?.so2r]);

  // Don't render anything if bridge is not alive
  if (!data?.bridgeAlive || !data?.connected) return null;

  const isSo2r = !!data.so2r;
  const radioA = data.so2rRadioA;
  const radioB = data.so2rRadioB;
  const roles = data.so2rRoles;

  // SO2R display values
  const runRadio = isSo2r && radioA && radioB && roles
    ? (roles.run === "A" ? radioA : radioB)
    : null;
  const multiRadio = isSo2r && radioA && radioB && roles
    ? (roles.multi === "A" ? radioA : radioB)
    : null;

  const runFreqStr = runRadio && runRadio.freq > 0 ? runRadio.freq.toFixed(3) : "—";
  const multiFreqStr = multiRadio && multiRadio.freq > 0 ? multiRadio.freq.toFixed(3) : "—";
  const runBand = runRadio && runRadio.freq > 0 ? getBand(runRadio.freq) : "";
  const multiBand = multiRadio && multiRadio.freq > 0 ? getBand(multiRadio.freq) : "";

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 mx-auto flex-wrap">
      {/* ─── SO2R section (only when dual-slice is active) ─── */}
      {isSo2r && runRadio && multiRadio && (
        <>
          {/* MULTI (gauche = oreille gauche) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">MULTI</span>
              {multiBand && (
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                  {multiBand}
                </span>
              )}
            </div>
            <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground leading-none">
              {multiFreqStr}
            </span>
            <span className="text-xs text-muted-foreground">{multiRadio.mode}</span>
          </div>

          {/* SWAP */}
          <button
            onClick={handleSwap}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-lg border-2 border-primary/40 px-3 py-2",
              "text-sm font-bold text-primary/90",
              "transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/60",
              "active:scale-[0.93] active:bg-primary/20"
            )}
            title="SWAP RUN ↔ MULTI (Ctrl+Tab)"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">SWAP</span>
          </button>

          {/* RUN (droite = oreille droite) */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground leading-none">
              {runFreqStr}
            </span>
            <span className="text-xs text-muted-foreground">{runRadio.mode}</span>
            {runRadio.tx && (
              <span className="flex items-center gap-0.5 rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">
                <Zap className="h-3 w-3" />TX
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">RUN</span>
              {runBand && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {runBand}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── FILTRE AUDIO (Popover — TOUJOURS visible quand bridge connecté) ─── */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer active:scale-[0.97]",
              filterOpen || activePreset
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            )}
            title="Filtre audio RX + DSP"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{activePreset ? FILTER_PRESETS.find(p => p.id === activePreset)?.label : "Filtre Audio"}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-3" align="end" side="top" sideOffset={8}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-foreground">Filtre Audio & DSP</span>
            </div>
            {activePreset && (
              <button
                onClick={() => { setActivePreset(null); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Réinit.
              </button>
            )}
          </div>

          {/* ═══ DSP Toggles ═══ */}
          <div className="mb-3 pb-3 border-b border-border/30">
            <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
              DSP
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <DspToggle label="EQ" active={eqEnabled} onClick={handleToggleEq} />
              <DspToggle label="NB" active={nbEnabled} onClick={handleToggleNb} />
              <DspToggle label="NR" active={nrEnabled} onClick={handleToggleNr} />
              <DspToggle label="ANF" active={anfEnabled} onClick={handleToggleAnf} />
            </div>
          </div>

          {/* ═══ SSB / DX section ═══ */}
          <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
            SSB / DX
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {FILTER_PRESETS.filter(p => p.cat === "SSB").map(p => (
              <button
                key={p.id}
                onClick={() => handlePreset(p.id)}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-left text-xs transition-all border",
                  activePreset === p.id
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10"
                    : "border-transparent hover:bg-white/5 text-foreground/80 hover:text-foreground"
                )}
              >
                <div className="font-semibold">{p.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* ═══ CW / Digital section ═══ */}
          <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
            CW / Digital
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {FILTER_PRESETS.filter(p => p.cat === "CW" || p.cat === "DIGI").map(p => (
              <button
                key={p.id}
                onClick={() => handlePreset(p.id)}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-left text-xs transition-all border",
                  activePreset === p.id
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10"
                    : "border-transparent hover:bg-white/5 text-foreground/80 hover:text-foreground"
                )}
              >
                <div className="font-semibold">{p.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** DSP Toggle button component */
function DspToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-2 py-1.5 text-xs font-bold text-center transition-all border",
        active
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : "bg-transparent text-muted-foreground border-border/40 hover:bg-white/5 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
