import { useState, useCallback, useEffect } from "react";

const DEFAULT_BRIDGE_URL = "http://localhost:7301";
const STORAGE_KEY = "dxhunter-cat-config";

export interface CatConfig {
  enabled: boolean;
  bridgeUrl: string;
}

interface CatState {
  config: CatConfig;
  connected: boolean;
  lastQsy: string | null;
}

function loadConfig(): CatConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, bridgeUrl: DEFAULT_BRIDGE_URL };
}

function saveConfig(config: CatConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useCat() {
  const [state, setState] = useState<CatState>({
    config: loadConfig(),
    connected: false,
    lastQsy: null,
  });

  // Check connection status periodically
  useEffect(() => {
    if (!state.config.enabled) {
      setState((s) => ({ ...s, connected: false }));
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${state.config.bridgeUrl}/status`, {
          signal: AbortSignal.timeout(2000),
        });
        const data = await res.json();
        if (!cancelled) setState((s) => ({ ...s, connected: data.ok && data.connected }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, connected: false }));
      }
    };

    check();
    const interval = setInterval(check, 10000); // Check every 10s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state.config.enabled, state.config.bridgeUrl]);

  const updateConfig = useCallback((partial: Partial<CatConfig>) => {
    setState((s) => {
      const newConfig = { ...s.config, ...partial };
      saveConfig(newConfig);
      return { ...s, config: newConfig };
    });
  }, []);

  const qsy = useCallback(
    async (freqKhz: number, mode?: string) => {
      if (!state.config.enabled) return false;
      try {
        const res = await fetch(`${state.config.bridgeUrl}/qsy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freqKhz, mode: mode || undefined }),
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        if (data.ok) {
          setState((s) => ({
            ...s,
            lastQsy: `${freqKhz} kHz ${mode || ""}`.trim(),
          }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [state.config.enabled, state.config.bridgeUrl]
  );

  return {
    catEnabled: state.config.enabled,
    catConnected: state.connected,
    catConfig: state.config,
    lastQsy: state.lastQsy,
    updateCatConfig: updateConfig,
    qsy,
  };
}
