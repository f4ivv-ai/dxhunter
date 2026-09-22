/**
 * useFlexCat — Hook React pour la connexion CAT via relay HTTP (polling tRPC).
 *
 * Le bridge local envoie l'état radio au serveur via POST (cat.push).
 * Ce hook poll le serveur via GET (cat.state) toutes les 1.5s.
 * Les commandes QSY sont envoyées via POST (cat.command).
 *
 * Compatible Autoscale serverless (pas de WebSocket nécessaire).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export interface FlexStatus {
  connected: boolean;
  radio?: string;
  version?: string;
  station: string;
  model: string;
  operationMode: "monitor" | "receive" | "operate";
  txControlAllowed: boolean;
  audioProfile: string;
  audioInputDevice: string;
  audioOutputDevice: string;
  audioDaxEnabled: boolean;
  audioListenOnly: boolean;
}

export interface So2rInfo {
  enabled: boolean;
  roles: { run: string; multi: string };
  radioA: {
    connected: boolean;
    freq: number;
    mode: string;
    name: string;
    tx: boolean;
    rfPower: number;
    nbEnabled: boolean;
    nrEnabled?: boolean;
    anfEnabled?: boolean;
    filterLo?: number;
    filterHi?: number;
  } | null;
  radioB: {
    connected: boolean;
    freq: number;
    mode: string;
    name: string;
    tx: boolean;
    rfPower: number;
    nbEnabled: boolean;
    nrEnabled?: boolean;
    anfEnabled?: boolean;
    filterLo?: number;
    filterHi?: number;
  } | null;
}

export function useFlexCat(options: { autoConnect?: boolean } = {}) {
  const { autoConnect = false } = options;

  const [active, setActive] = useState(autoConnect);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [radioConnected, setRadioConnected] = useState(false);
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const [currentMode, setCurrentMode] = useState<string>("");
  const [status, setStatus] = useState<FlexStatus>({
    connected: false,
    station: "Maison",
    model: "FLEX-6600M",
    operationMode: "monitor",
    txControlAllowed: false,
    audioProfile: "unconfigured",
    audioInputDevice: "",
    audioOutputDevice: "",
    audioDaxEnabled: false,
    audioListenOnly: true,
  });
  const [lastQsy, setLastQsy] = useState<{
    freq: number;
    mode?: string;
  } | null>(null);
  const [so2r, setSo2r] = useState<So2rInfo>({
    enabled: false,
    roles: { run: "A", multi: "B" },
    radioA: null,
    radioB: null,
  });

  // Poll cat.state every 1.5s when active
  const { data } = trpc.cat.state.useQuery(undefined, {
    enabled: active,
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  // Update local state from polled data
  useEffect(() => {
    if (!data) return;
    setBridgeConnected(data.bridgeAlive);
    setRadioConnected(data.connected);
    if (data.freq && data.freq > 0) setCurrentFreq(data.freq);
    if (data.mode) setCurrentMode(data.mode);
    setStatus({
      connected: data.connected,
      radio: data.radio ?? undefined,
      version: data.version ?? undefined,
      station: data.station,
      model: data.model,
      operationMode: data.operationMode,
      txControlAllowed: data.txControlAllowed,
      audioProfile: data.audioProfile,
      audioInputDevice: data.audioInputDevice,
      audioOutputDevice: data.audioOutputDevice,
      audioDaxEnabled: data.audioDaxEnabled,
      audioListenOnly: data.audioListenOnly,
    });
    // SO2R state
    setSo2r({
      enabled: !!data.so2r,
      roles: data.so2rRoles ?? { run: "A", multi: "B" },
      radioA: data.so2rRadioA ?? null,
      radioB: data.so2rRadioB ?? null,
    });
  }, [data]);

  // Command mutation
  const commandMutation = trpc.cat.command.useMutation();

  const connect = useCallback(() => {
    setActive(true);
  }, []);

  const disconnect = useCallback(() => {
    setActive(false);
    setBridgeConnected(false);
    setRadioConnected(false);
    setStatus({
      connected: false,
      station: "Maison",
      model: "FLEX-6600M",
      operationMode: "monitor",
      txControlAllowed: false,
      audioProfile: "unconfigured",
      audioInputDevice: "",
      audioOutputDevice: "",
      audioDaxEnabled: false,
      audioListenOnly: true,
    });
  }, []);

  const qsy = useCallback(
    (freq: number, mode?: string, slice?: number) => {
      if (!radioConnected || status.operationMode === "monitor") return false;
      commandMutation.mutate(
        { action: "qsy", freq, mode, slice },
        {
          onSuccess: () => {
            setLastQsy({ freq, mode });
          },
        }
      );
      return true;
    },
    [commandMutation, radioConnected, status.operationMode]
  );

  const split = useCallback(
    (rxFreq: number, txFreq: number, mode?: string) => {
      if (status.operationMode !== "operate") return false;
      commandMutation.mutate(
        { action: "split", rxFreq, txFreq, mode },
        {
          onSuccess: () => {
            setLastQsy({ freq: rxFreq, mode });
          },
        }
      );
      return true;
    },
    [commandMutation, status.operationMode]
  );

  /** QSY vers le poste MULTI (SO2R) */
  const qsyMulti = useCallback(
    (freq: number, mode?: string) => {
      if (!radioConnected || status.operationMode === "monitor") return false;
      commandMutation.mutate(
        { action: "qsy_multi", freq, mode },
        {
          onSuccess: () => {
            setLastQsy({ freq, mode });
          },
        }
      );
      return true;
    },
    [commandMutation, radioConnected, status.operationMode]
  );

  /** SWAP + QSY (SO2R) : QSY le MULTI puis inverse les rôles */
  const swapAndQsy = useCallback(
    (freq: number, mode?: string) => {
      if (status.operationMode !== "operate") return false;
      commandMutation.mutate(
        { action: "swap_and_qsy", freq, mode },
        {
          onSuccess: () => {
            setLastQsy({ freq, mode });
          },
        }
      );
      return true;
    },
    [commandMutation, status.operationMode]
  );

  /** SWAP les rôles RUN/MULTI */
  const swap = useCallback(() => {
    if (status.operationMode !== "operate") return false;
    commandMutation.mutate({ action: "swap" });
    return true;
  }, [commandMutation, status.operationMode]);

  return {
    /** Activer le polling */
    connect,
    /** Désactiver le polling */
    disconnect,
    /** Le bridge est-il vivant (a pushé récemment) ? */
    bridgeConnected,
    /** Le FlexRadio est-il connecté via le bridge ? */
    radioConnected,
    /** Status complet du Flex */
    status,
    /** Envoyer un QSY (freq en MHz, mode optionnel) */
    qsy,
    /** Envoyer un Split */
    split,
    /** Dernier QSY réussi */
    lastQsy,
    /** Fréquence actuelle du poste (MHz) */
    currentFreq,
    /** Mode actuel du poste */
    currentMode,
    /** État SO2R */
    so2r,
    /** QSY vers MULTI (SO2R) */
    qsyMulti,
    /** SWAP + QSY (SO2R) */
    swapAndQsy,
    /** SWAP rôles RUN/MULTI */
    swap,
  };
}
