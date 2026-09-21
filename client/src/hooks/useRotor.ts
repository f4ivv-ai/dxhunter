/**
 * useRotor — Hook React pour la commande du rotor via l'API tRPC proxy.
 *
 * Poll l'état du rotor toutes les 2s.
 * Expose goTo(azimuth) et stop().
 */
import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export function useRotor() {
  const [active, setActive] = useState(true);
  const [lastGoTo, setLastGoTo] = useState<number | null>(null);

  // Poll rotor.state every 2s
  const { data } = trpc.rotor.state.useQuery(undefined, {
    enabled: active,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });

  const goToMutation = trpc.rotor.goTo.useMutation();
  const stopMutation = trpc.rotor.stop.useMutation();

  const goTo = useCallback(
    (azimuth: number) => {
      const az = ((Math.round(azimuth) % 360) + 360) % 360;
      goToMutation.mutate(
        { azimuth: az },
        {
          onSuccess: () => setLastGoTo(az),
        }
      );
    },
    [goToMutation]
  );

  const stop = useCallback(() => {
    stopMutation.mutate();
  }, [stopMutation]);

  return {
    /** Azimut actuel du rotor (0-360°) */
    azimuth: data?.azimuth ?? 0,
    /** Statut brut de l'API rotor */
    status: data?.status ?? "unknown",
    /** Le rotor est-il connecté au matériel ? */
    connected: data?.connected ?? false,
    /** L'API rotor est-elle joignable ? */
    reachable: data?.reachable ?? false,
    /** Envoyer le rotor vers un azimut */
    goTo,
    /** Arrêter le rotor */
    stop,
    /** Dernier azimut commandé */
    lastGoTo,
    /** En cours d'envoi */
    isPending: goToMutation.isPending,
  };
}
