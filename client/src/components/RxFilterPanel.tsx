/**
 * RxFilterPanel — Panneau de filtrage RX automatique + Égaliseur + RF Gain
 * Intégré dans le Sheet "Flex Control".
 * Supporte les presets personnalisés (sauvegarde/suppression).
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useRxDsp } from "@/hooks/useRxDsp";
import {
  Zap,
  Volume2,
  Gauge,
  Wand2,
  SlidersHorizontal,
  Save,
  Trash2,
  Star,
  X,
} from "lucide-react";

// ─── EQ Band labels ─────────────────────────────────────────────────────────

const EQ_BAND_LABELS = ["63", "125", "250", "500", "1k", "2k", "4k", "8k"];

// ─── Props ──────────────────────────────────────────────────────────────────

interface RxFilterPanelProps {
  /** S-mètre actuel en dBm (pour le mode auto) */
  smeter: number;
  /** Mode radio actuel (SSB, CW, FT8, etc.) */
  mode: string;
}

export function RxFilterPanel({ smeter, mode }: RxFilterPanelProps) {
  const dsp = useRxDsp();
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [showSaveEq, setShowSaveEq] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [eqName, setEqName] = useState("");

  // ─── Auto-évaluation quand smeter ou mode change ──────────────────────────
  useEffect(() => {
    if (dsp.autoMode) {
      dsp.evaluateAutoPreset(smeter, mode);
      dsp.evaluateAutoRfGain(smeter);
    }
  }, [smeter, mode, dsp.autoMode]);

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    dsp.saveCurrentAsPreset(presetName.trim());
    setPresetName("");
    setShowSavePreset(false);
  };

  const handleSaveEq = () => {
    if (!eqName.trim()) return;
    dsp.saveCurrentEqAsProfile(eqName.trim());
    setEqName("");
    setShowSaveEq(false);
  };

  return (
    <div className="space-y-4 p-3">
      {/* ═══ Header + Mode Auto ═══ */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtrage RX & EQ
        </h3>
        <button
          onClick={() => dsp.setAutoMode(!dsp.autoMode)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-[0.97]",
            dsp.autoMode
              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400"
              : "border-border text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-400"
          )}
        >
          <Wand2 className="h-3 w-3" />
          AUTO
        </button>
      </div>

      {/* ═══ Presets de filtrage ═══ */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Presets filtrage
          </span>
          <button
            onClick={() => setShowSavePreset(!showSavePreset)}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
          >
            <Save className="h-2.5 w-2.5" />
            Sauver
          </button>
        </div>

        {/* Formulaire sauvegarde preset */}
        {showSavePreset && (
          <div className="flex items-center gap-1.5 mb-2 p-2 rounded border border-primary/30 bg-primary/5">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              placeholder="Nom du preset..."
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              autoFocus
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
            >
              OK
            </button>
            <button
              onClick={() => { setShowSavePreset(false); setPresetName(""); }}
              className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {dsp.presets.map((preset) => (
            <div key={preset.id} className="relative group">
              <button
                onClick={() => dsp.applyPreset(preset.id)}
                className={cn(
                  "w-full rounded-md border px-2 py-1.5 text-left transition-all active:scale-[0.97]",
                  dsp.activePreset === preset.id
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                <div className={cn(
                  "text-[11px] font-bold leading-tight flex items-center gap-1",
                  dsp.activePreset === preset.id ? "text-primary" : "text-foreground"
                )}>
                  {preset.isCustom && <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />}
                  {preset.name}
                </div>
                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                  {preset.description}
                </div>
              </button>
              {/* Bouton supprimer (presets custom uniquement) */}
              {preset.isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); dsp.deleteCustomPreset(preset.id); }}
                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Filtre passe-bande (visuel) ═══ */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Filtre passe-bande
          </span>
          <span className="font-mono text-[11px] text-primary font-bold">
            {dsp.filterLo} – {dsp.filterHi} Hz
          </span>
        </div>
        {/* Barre visuelle du filtre */}
        <div className="relative h-6 rounded bg-muted/30 border border-border overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-primary/20 border-x border-primary/40"
            style={{
              left: `${(dsp.filterLo / 3200) * 100}%`,
              right: `${100 - (dsp.filterHi / 3200) * 100}%`,
            }}
          />
          {/* Marqueurs de fréquence */}
          <div className="absolute inset-0 flex items-end justify-between px-1 pb-0.5">
            <span className="text-[8px] text-muted-foreground">0</span>
            <span className="text-[8px] text-muted-foreground">800</span>
            <span className="text-[8px] text-muted-foreground">1.6k</span>
            <span className="text-[8px] text-muted-foreground">2.4k</span>
            <span className="text-[8px] text-muted-foreground">3.2k</span>
          </div>
        </div>
        {/* Sliders lo/hi */}
        <div className="flex gap-2 mt-1.5">
          <div className="flex-1">
            <label className="text-[9px] text-muted-foreground">Low Cut</label>
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={dsp.filterLo}
              onChange={(e) => dsp.setFilter(Number(e.target.value), dsp.filterHi)}
              className="w-full h-1.5 accent-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-muted-foreground">High Cut</label>
            <input
              type="range"
              min={1500}
              max={3200}
              step={50}
              value={dsp.filterHi}
              onChange={(e) => dsp.setFilter(dsp.filterLo, Number(e.target.value))}
              className="w-full h-1.5 accent-primary"
            />
          </div>
        </div>
      </div>

      {/* ═══ RF Gain ═══ */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            RF Gain
          </span>
          <span className={cn(
            "font-mono text-[11px] font-bold",
            dsp.rfGain > 16 ? "text-amber-400" : dsp.rfGain < -4 ? "text-cyan-400" : "text-foreground"
          )}>
            {dsp.rfGain > 0 ? "+" : ""}{dsp.rfGain} dB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground w-6">-8</span>
          <input
            type="range"
            min={-8}
            max={32}
            step={1}
            value={dsp.rfGain}
            onChange={(e) => dsp.setRfGainValue(Number(e.target.value))}
            className="flex-1 h-2 accent-primary"
          />
          <span className="text-[9px] text-muted-foreground w-6">+32</span>
        </div>
        {/* Indicateur visuel S-mètre pour contexte */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[9px] text-muted-foreground">S-mètre:</span>
          <SmeterBar value={smeter} />
          <span className="font-mono text-[9px] text-muted-foreground">
            {smeterToS(smeter)}
          </span>
        </div>
      </div>

      {/* ═══ Égaliseur RX ═══ */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            Égaliseur RX
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSaveEq(!showSaveEq)}
              className="flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
            >
              <Save className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={() => dsp.toggleEq(!dsp.eqEnabled)}
              className={cn(
                "rounded border px-2 py-0.5 text-[9px] font-bold transition-all",
                dsp.eqEnabled
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {dsp.eqEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Formulaire sauvegarde EQ */}
        {showSaveEq && (
          <div className="flex items-center gap-1.5 mb-2 p-2 rounded border border-primary/30 bg-primary/5">
            <input
              type="text"
              value={eqName}
              onChange={(e) => setEqName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEq()}
              placeholder="Nom du profil EQ..."
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              autoFocus
            />
            <button
              onClick={handleSaveEq}
              disabled={!eqName.trim()}
              className="rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
            >
              OK
            </button>
            <button
              onClick={() => { setShowSaveEq(false); setEqName(""); }}
              className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Profils EQ */}
        <div className="flex flex-wrap gap-1 mb-2">
          {dsp.eqProfiles.map((profile) => (
            <div key={profile.id} className="relative group">
              <button
                onClick={() => dsp.applyEqProfile(profile.id)}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[9px] font-bold transition-all active:scale-[0.97]",
                  dsp.activeEqProfile === profile.id
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {profile.isCustom && <Star className="inline h-2 w-2 text-amber-400 fill-amber-400 mr-0.5" />}
                {profile.name}
              </button>
              {profile.isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); dsp.deleteCustomEqProfile(profile.id); }}
                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground"
                >
                  <Trash2 className="h-2 w-2" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Barres EQ graphiques */}
        <div className={cn(
          "flex items-end justify-between gap-1 h-20 px-1 rounded border border-border bg-muted/20 pt-1 pb-0.5 transition-opacity",
          !dsp.eqEnabled && "opacity-40"
        )}>
          {dsp.eqBands.map((value, i) => (
            <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
              {/* Barre verticale */}
              <div className="relative flex-1 w-full flex items-center justify-center">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={value}
                  onChange={(e) => dsp.setEqBand(i, Number(e.target.value))}
                  disabled={!dsp.eqEnabled}
                  className="absolute w-16 h-1.5 accent-primary"
                  style={{
                    transform: "rotate(-90deg)",
                    transformOrigin: "center",
                  }}
                />
              </div>
              {/* Label + valeur */}
              <div className="text-center mt-0.5">
                <div className={cn(
                  "font-mono text-[8px] font-bold",
                  value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {value > 0 ? "+" : ""}{value}
                </div>
                <div className="text-[7px] text-muted-foreground">{EQ_BAND_LABELS[i]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Indicateur mode auto actif ═══ */}
      {dsp.autoMode && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-[10px] text-emerald-400 flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          <span>
            Mode auto actif — le preset, l'EQ et le RF Gain s'adaptent au S-mètre ({smeterToS(smeter)}) et au mode ({mode || "—"})
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function smeterToS(dbm: number): string {
  if (dbm >= -53) return `S9+${Math.round(dbm + 53)}`;
  const s = Math.max(0, Math.round((dbm + 127) / 6));
  return `S${s}`;
}

function SmeterBar({ value }: { value: number }) {
  // Normalize -127...-13 dBm to 0...100%
  const pct = Math.max(0, Math.min(100, ((value + 127) / 114) * 100));
  return (
    <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden max-w-[80px]">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          pct > 75 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
