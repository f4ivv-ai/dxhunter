/**
 * useRxDsp — Hook pour le contrôle DSP RX du FlexRadio
 * Gère les presets de filtrage, l'égaliseur RX et le RF Gain adaptatif.
 * Communique avec le bridge via le catRelay (commandes setfilter, setrfgain, seteq, setpreset, apf).
 * Supporte les presets personnalisés sauvegardés en localStorage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RxFilterPreset {
  id: string;
  name: string;
  description: string;
  filterLo: number;   // Hz
  filterHi: number;   // Hz
  nb: boolean;
  nr: boolean;
  anf: boolean;
  apf: boolean;
  rfGainOffset: number; // dB offset suggestion (relative to baseline)
  eqProfile: string;    // ID of EQ profile to apply
  isCustom?: boolean;   // true if user-created
  /** Conditions for auto-selection */
  autoConditions?: {
    smeterMin?: number;  // dBm
    smeterMax?: number;  // dBm
    modeFamily?: "SSB" | "CW" | "DIGI";
  };
}

export interface EqProfile {
  id: string;
  name: string;
  description: string;
  bands: number[]; // 8 values in dB (-12 to +12) for 63, 125, 250, 500, 1k, 2k, 4k, 8k Hz
  isCustom?: boolean;
}

// ─── Presets de filtrage (built-in) ───────────────────────────────────────────

export const BUILTIN_FILTER_PRESETS: RxFilterPreset[] = [
  {
    id: "dx_open",
    name: "DX Ouvert",
    description: "Signal fort, peu de QRM — filtre large, pas de traitement",
    filterLo: 100,
    filterHi: 2800,
    nb: false,
    nr: false,
    anf: false,
    apf: false,
    rfGainOffset: 0,
    eqProfile: "natural",
    autoConditions: { smeterMin: -73, modeFamily: "SSB" }, // > S6
  },
  {
    id: "dx_pileup",
    name: "DX Pile-up",
    description: "Beaucoup de stations — filtre resserré, NB actif",
    filterLo: 200,
    filterHi: 2600,
    nb: true,
    nr: false,
    anf: false,
    apf: false,
    rfGainOffset: -4,
    eqProfile: "dx_distant",
    autoConditions: { smeterMin: -85, smeterMax: -73, modeFamily: "SSB" },
  },
  {
    id: "dx_weak",
    name: "DX Faible",
    description: "Signal faible, bruit de fond — filtre étroit, NR actif",
    filterLo: 300,
    filterHi: 2400,
    nb: true,
    nr: true,
    anf: false,
    apf: false,
    rfGainOffset: 8,
    eqProfile: "dx_distant",
    autoConditions: { smeterMax: -85, modeFamily: "SSB" }, // < S3
  },
  {
    id: "qrm_severe",
    name: "QRM Sévère",
    description: "Interférences fortes — filtre très étroit, tous traitements actifs",
    filterLo: 400,
    filterHi: 2200,
    nb: true,
    nr: true,
    anf: true,
    apf: false,
    rfGainOffset: -8,
    eqProfile: "anti_splash",
  },
  {
    id: "cw_comfort",
    name: "CW Confort",
    description: "CW normal — filtre 400 Hz centré",
    filterLo: 400,
    filterHi: 800,
    nb: false,
    nr: false,
    anf: false,
    apf: false,
    rfGainOffset: 0,
    eqProfile: "cw_peak",
    autoConditions: { smeterMin: -85, modeFamily: "CW" },
  },
  {
    id: "cw_contest",
    name: "CW Contest",
    description: "CW rapide, pile-up — filtre 200 Hz, APF actif",
    filterLo: 500,
    filterHi: 700,
    nb: true,
    nr: false,
    anf: false,
    apf: true,
    rfGainOffset: 4,
    eqProfile: "cw_peak",
    autoConditions: { smeterMax: -85, modeFamily: "CW" },
  },
  {
    id: "ssb_narrow",
    name: "SSB Étroit",
    description: "SSB en conditions difficiles — bande passante réduite",
    filterLo: 300,
    filterHi: 2200,
    nb: true,
    nr: true,
    anf: false,
    apf: false,
    rfGainOffset: 0,
    eqProfile: "natural",
  },
  {
    id: "digi_wide",
    name: "Digital Large",
    description: "FT8/FT4/RTTY — filtre large, pas de traitement audio",
    filterLo: 100,
    filterHi: 3000,
    nb: false,
    nr: false,
    anf: false,
    apf: false,
    rfGainOffset: 0,
    eqProfile: "flat",
    autoConditions: { modeFamily: "DIGI" },
  },
];

// ─── Profils d'égaliseur (built-in) ──────────────────────────────────────────

export const BUILTIN_EQ_PROFILES: EqProfile[] = [
  {
    id: "flat",
    name: "Plat",
    description: "Aucune correction — réponse neutre",
    bands: [0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "natural",
    name: "Voix naturelle",
    description: "Boost léger 800-2000 Hz pour l'intelligibilité",
    bands: [0, 0, 0, 2, 4, 3, 0, 0],
  },
  {
    id: "dx_distant",
    name: "DX lointain",
    description: "Boost 1000-1500 Hz pour compenser le fading HF",
    bands: [-2, -1, 0, 3, 6, 4, 1, -2],
  },
  {
    id: "anti_splash",
    name: "Anti-splash",
    description: "Atténuation basses et hautes — focus voix",
    bands: [-8, -4, -2, 2, 3, 2, -4, -8],
  },
  {
    id: "cw_peak",
    name: "CW Pic",
    description: "Pic étroit autour de 600-800 Hz",
    bands: [-6, -4, -2, 6, 8, -2, -6, -8],
  },
  {
    id: "bass_cut",
    name: "Coupe basses",
    description: "Supprime le grondement basse fréquence (QRN orage)",
    bands: [-12, -8, -4, 0, 0, 0, 0, 0],
  },
  {
    id: "presence",
    name: "Présence",
    description: "Boost médiums-hauts pour percer dans le bruit",
    bands: [-2, 0, 0, 0, 2, 6, 4, 0],
  },
  {
    id: "contest",
    name: "Contest",
    description: "Optimisé pour la fatigue longue durée — médiums doux",
    bands: [-4, -2, 0, 3, 4, 2, -2, -6],
  },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

const CUSTOM_PRESETS_KEY = "dxhunter_custom_rx_presets";
const CUSTOM_EQ_KEY = "dxhunter_custom_eq_profiles";

function loadCustomPresets(): RxFilterPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RxFilterPreset[];
  } catch {
    return [];
  }
}

function saveCustomPresets(presets: RxFilterPreset[]) {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  } catch {}
}

function loadCustomEqProfiles(): EqProfile[] {
  try {
    const raw = localStorage.getItem(CUSTOM_EQ_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EqProfile[];
  } catch {
    return [];
  }
}

function saveCustomEqProfiles(profiles: EqProfile[]) {
  try {
    localStorage.setItem(CUSTOM_EQ_KEY, JSON.stringify(profiles));
  } catch {}
}

// ─── RF Gain adaptatif ──────────────────────────────────────────────────────

/** Calcule le RF Gain optimal basé sur le S-mètre */
export function computeAdaptiveRfGain(smeterDbm: number, baseGain: number = 0): number {
  // Si le signal est très fort (> S9+10), réduire le gain pour éviter saturation
  if (smeterDbm > -53) return Math.max(-8, baseGain - 12);
  // Si fort (S7-S9+10), légère réduction
  if (smeterDbm > -73) return Math.max(-8, baseGain - 4);
  // Signal moyen (S4-S7), gain nominal
  if (smeterDbm > -93) return baseGain;
  // Signal faible (S1-S4), augmenter le gain
  if (smeterDbm > -107) return Math.min(32, baseGain + 8);
  // Très faible (< S1), gain maximum
  return Math.min(32, baseGain + 16);
}

/** Détermine la famille de mode depuis la chaîne mode */
function getModeFamily(mode: string): "SSB" | "CW" | "DIGI" {
  const m = mode.toUpperCase();
  if (m.includes("CW")) return "CW";
  if (m.includes("FT") || m.includes("RTTY") || m.includes("PSK") || m.includes("DIGI") || m.includes("JT")) return "DIGI";
  return "SSB";
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseRxDspOptions {
  /** Activer le mode automatique au démarrage */
  autoMode?: boolean;
}

export function useRxDsp(options: UseRxDspOptions = {}) {
  const [activePreset, setActivePreset] = useState<string>("dx_open");
  const [activeEqProfile, setActiveEqProfile] = useState<string>("natural");
  const [autoMode, setAutoMode] = useState(options.autoMode ?? false);
  const [rfGain, setRfGain] = useState(0);
  const [filterLo, setFilterLo] = useState(100);
  const [filterHi, setFilterHi] = useState(2800);
  const [eqEnabled, setEqEnabled] = useState(false);
  const [eqBands, setEqBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [apfEnabled, setApfEnabled] = useState(false);

  // Custom presets (persisted in localStorage)
  const [customPresets, setCustomPresets] = useState<RxFilterPreset[]>(() => loadCustomPresets());
  const [customEqProfiles, setCustomEqProfiles] = useState<EqProfile[]>(() => loadCustomEqProfiles());

  const catCommand = trpc.cat.command.useMutation();
  const lastAutoSwitch = useRef(0);

  // All presets = built-in + custom
  const allPresets = [...BUILTIN_FILTER_PRESETS, ...customPresets];
  const allEqProfiles = [...BUILTIN_EQ_PROFILES, ...customEqProfiles];

  // ─── Sauvegarder un preset personnalisé ─────────────────────────────────────

  const saveCustomPreset = useCallback((preset: Omit<RxFilterPreset, "id" | "isCustom">) => {
    const id = `custom_${Date.now()}`;
    const newPreset: RxFilterPreset = { ...preset, id, isCustom: true };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    return id;
  }, [customPresets]);

  const updateCustomPreset = useCallback((id: string, updates: Partial<RxFilterPreset>) => {
    const updated = customPresets.map(p => p.id === id ? { ...p, ...updates } : p);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  }, [customPresets]);

  const deleteCustomPreset = useCallback((id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  }, [customPresets]);

  // ─── Sauvegarder un profil EQ personnalisé ──────────────────────────────────

  const saveCustomEqProfile = useCallback((profile: Omit<EqProfile, "id" | "isCustom">) => {
    const id = `custom_eq_${Date.now()}`;
    const newProfile: EqProfile = { ...profile, id, isCustom: true };
    const updated = [...customEqProfiles, newProfile];
    setCustomEqProfiles(updated);
    saveCustomEqProfiles(updated);
    return id;
  }, [customEqProfiles]);

  const deleteCustomEqProfile = useCallback((id: string) => {
    const updated = customEqProfiles.filter(p => p.id !== id);
    setCustomEqProfiles(updated);
    saveCustomEqProfiles(updated);
  }, [customEqProfiles]);

  // ─── Sauvegarder les réglages actuels comme preset ──────────────────────────

  const saveCurrentAsPreset = useCallback((name: string, description: string = "") => {
    return saveCustomPreset({
      name,
      description: description || `Preset personnalisé — ${filterLo}-${filterHi} Hz`,
      filterLo,
      filterHi,
      nb: false, // On ne peut pas lire l'état NB/NR depuis ici, le preset sauvegarde les filtres
      nr: false,
      anf: false,
      apf: apfEnabled,
      rfGainOffset: rfGain,
      eqProfile: activeEqProfile,
    });
  }, [filterLo, filterHi, apfEnabled, rfGain, activeEqProfile, saveCustomPreset]);

  const saveCurrentEqAsProfile = useCallback((name: string, description: string = "") => {
    return saveCustomEqProfile({
      name,
      description: description || `EQ personnalisé`,
      bands: [...eqBands],
    });
  }, [eqBands, saveCustomEqProfile]);

  // ─── Appliquer un preset ──────────────────────────────────────────────────

  const applyPreset = useCallback((presetId: string) => {
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) return;

    setActivePreset(presetId);
    setFilterLo(preset.filterLo);
    setFilterHi(preset.filterHi);
    setApfEnabled(preset.apf);

    // Envoyer les commandes au bridge
    catCommand.mutate({
      action: "setpreset",
      preset: presetId,
      filterLo: preset.filterLo,
      filterHi: preset.filterHi,
    });

    // DSP toggles
    catCommand.mutate({ action: "dsp", param: "nb", enabled: preset.nb });
    catCommand.mutate({ action: "dsp", param: "nr", enabled: preset.nr });
    catCommand.mutate({ action: "dsp", param: "anf", enabled: preset.anf });
    catCommand.mutate({ action: "dsp", param: "apf", enabled: preset.apf });

    // Appliquer le profil EQ associé
    applyEqProfile(preset.eqProfile);
  }, [allPresets]);

  // ─── Appliquer un profil EQ ───────────────────────────────────────────────

  const applyEqProfile = useCallback((profileId: string) => {
    const profile = allEqProfiles.find(p => p.id === profileId);
    if (!profile) return;

    setActiveEqProfile(profileId);
    setEqBands(profile.bands);
    setEqEnabled(true);

    catCommand.mutate({
      action: "dsp",
      param: "eq",
      eqBands: profile.bands,
      enabled: true,
    });
  }, [allEqProfiles]);

  // ─── Régler le RF Gain ────────────────────────────────────────────────────

  const setRfGainValue = useCallback((value: number) => {
    const clamped = Math.max(-8, Math.min(32, value));
    setRfGain(clamped);
    catCommand.mutate({ action: "dsp", param: "rfgain", value: clamped });
  }, []);

  // ─── Régler le filtre manuellement ────────────────────────────────────────

  const setFilter = useCallback((lo: number, hi: number) => {
    setFilterLo(lo);
    setFilterHi(hi);
    setActivePreset("manual");
    catCommand.mutate({ action: "setfilter", filterLo: lo, filterHi: hi });
  }, []);

  // ─── Toggle EQ ────────────────────────────────────────────────────────────

  const toggleEq = useCallback((enabled: boolean) => {
    setEqEnabled(enabled);
    catCommand.mutate({ action: "dsp", param: "eq", enabled, eqBands });
  }, [eqBands]);

  // ─── Régler une bande EQ individuellement ─────────────────────────────────

  const setEqBand = useCallback((index: number, value: number) => {
    const newBands = [...eqBands];
    newBands[index] = Math.max(-12, Math.min(12, value));
    setEqBands(newBands);
    catCommand.mutate({ action: "dsp", param: "eq", eqBands: newBands, enabled: eqEnabled });
  }, [eqBands, eqEnabled]);

  // ─── Mode automatique : sélection du preset selon les conditions ──────────

  const evaluateAutoPreset = useCallback((smeter: number, mode: string) => {
    if (!autoMode) return;

    // Throttle : pas plus d'un switch toutes les 5 secondes
    const now = Date.now();
    if (now - lastAutoSwitch.current < 5000) return;

    const family = getModeFamily(mode);

    // Trouver le meilleur preset selon les conditions (inclut les custom avec autoConditions)
    let bestPreset: RxFilterPreset | null = null;
    let bestScore = -1;

    for (const preset of allPresets) {
      if (!preset.autoConditions) continue;
      const cond = preset.autoConditions;
      let score = 0;

      // Vérifier la famille de mode
      if (cond.modeFamily && cond.modeFamily !== family) continue;
      if (cond.modeFamily === family) score += 10;

      // Vérifier le S-mètre
      if (cond.smeterMin !== undefined && smeter < cond.smeterMin) continue;
      if (cond.smeterMax !== undefined && smeter > cond.smeterMax) continue;
      score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestPreset = preset;
      }
    }

    if (bestPreset && bestPreset.id !== activePreset) {
      lastAutoSwitch.current = now;
      applyPreset(bestPreset.id);
    }
  }, [autoMode, activePreset, applyPreset, allPresets]);

  // ─── RF Gain adaptatif en mode auto ───────────────────────────────────────

  const evaluateAutoRfGain = useCallback((smeter: number) => {
    if (!autoMode) return;
    const preset = allPresets.find(p => p.id === activePreset);
    const offset = preset?.rfGainOffset ?? 0;
    const optimal = computeAdaptiveRfGain(smeter, offset);
    if (Math.abs(optimal - rfGain) >= 4) {
      setRfGainValue(optimal);
    }
  }, [autoMode, activePreset, rfGain, setRfGainValue, allPresets]);

  return {
    // State
    activePreset,
    activeEqProfile,
    autoMode,
    rfGain,
    filterLo,
    filterHi,
    eqEnabled,
    eqBands,
    apfEnabled,
    // All presets (built-in + custom)
    presets: allPresets,
    eqProfiles: allEqProfiles,
    // Custom presets management
    customPresets,
    customEqProfiles,
    saveCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
    saveCustomEqProfile,
    deleteCustomEqProfile,
    saveCurrentAsPreset,
    saveCurrentEqAsProfile,
    // Actions
    applyPreset,
    applyEqProfile,
    setRfGainValue,
    setFilter,
    toggleEq,
    setEqBand,
    setAutoMode,
    // Auto evaluation (call from parent with telemetry data)
    evaluateAutoPreset,
    evaluateAutoRfGain,
  };
}
