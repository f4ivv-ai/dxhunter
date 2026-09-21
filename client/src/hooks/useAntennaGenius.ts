/**
 * useAntennaGenius — Hook React pour le contrôle de l'Antenna Genius 4O3A.
 *
 * Poll l'état de l'Antenna Genius via le relay HTTP (antenna.state).
 * Expose selectPort() et toggleAutoBand().
 */
import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

export function useAntennaGenius() {
  // Poll antenna.state every 2s
  const { data } = trpc.antenna.state.useQuery(undefined, {
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });

  const commandMutation = trpc.antenna.command.useMutation();

  /** Sélectionner un port d'antenne (1-8) */
  const selectPort = useCallback((port: number) => {
    commandMutation.mutate({ action: "select", port });
  }, [commandMutation]);

  /** Activer/désactiver la commutation automatique par bande */
  const toggleAutoBand = useCallback((enabled: boolean) => {
    commandMutation.mutate({ action: "autoband", enabled });
  }, [commandMutation]);

  return {
    /** L'Antenna Genius est-il connecté ? */
    connected: data?.connected ?? false,
    /** Le bridge est-il joignable ? */
    bridgeAlive: data?.bridgeAlive ?? false,
    /** Port actuellement sélectionné (1-8) */
    selectedPort: data?.selectedPort ?? 1,
    /** Nombre de ports disponibles */
    portCount: data?.portCount ?? 4,
    /** Noms des antennes par port */
    portNames: data?.portNames ?? ["Port 1", "Port 2", "Port 3", "Port 4"],
    /** Mapping bande → port */
    bandMap: data?.bandMap ?? {},
    /** Mode auto-band actif */
    autoBand: data?.autoBand ?? true,
    /** Sélectionner un port */
    selectPort,
    /** Toggle auto-band */
    toggleAutoBand,
    /** En cours d'envoi */
    isPending: commandMutation.isPending,
  };
}
