/**
 * useRotor — état et commandes du rotor Maison via le relais ARCO local.
 *
 * La télémétrie est disponible en lecture seule. Un déplacement ne peut être
 * demandé que lorsque le bridge, la politique et l'absence de priorité locale
 * l'autorisent explicitement. STOP reste disponible en cas de mouvement actif.
 */
import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";

export function useRotor() {
  const [active] = useState(true);
  const [lastGoTo, setLastGoTo] = useState<number | null>(null);

  const { data } = trpc.rotor.state.useQuery(undefined, {
    enabled: active,
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
  });

  const goToMutation = trpc.rotor.goTo.useMutation();
  const stopMutation = trpc.rotor.stop.useMutation();

  const goTo = useCallback(
    (azimuth: number) => {
      if (!data?.motionAllowed || data.localControl || !data.connected)
        return false;
      const az = ((Math.round(azimuth) % 360) + 360) % 360;
      goToMutation.mutate(
        { azimuth: az },
        {
          onSuccess: () => setLastGoTo(az),
        }
      );
      return true;
    },
    [data?.connected, data?.localControl, data?.motionAllowed, goToMutation]
  );

  const stop = useCallback(() => {
    stopMutation.mutate();
  }, [stopMutation]);

  return {
    azimuth: data?.azimuth ?? 0,
    targetAzimuth: data?.targetAzimuth ?? null,
    status: data?.status ?? "unknown",
    connected: data?.connected ?? false,
    reachable: data?.reachable ?? false,
    bridgeAlive: data?.bridgeAlive ?? false,
    station: data?.station ?? "Maison",
    controller: data?.controller ?? "microHAM ARCO",
    operationMode: data?.operationMode ?? "monitor",
    motionAllowed: data?.motionAllowed ?? false,
    localControl: data?.localControl ?? false,
    moving: data?.moving ?? false,
    errorMessage: data?.errorMessage ?? null,
    goTo,
    stop,
    lastGoTo,
    isPending: goToMutation.isPending || stopMutation.isPending,
  };
}
