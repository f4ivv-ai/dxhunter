import { trpc } from "@/lib/trpc";
import { SolarInputs } from "@/lib/propagation";

export interface SpaceWeather {
  kpNow: number | null;
  kpTime: string | null;
  aIndex: number | null;
  sfi: number | null;
  flareClass: string | null;
  flareTime: string | null;
  blackout: string | null;
  outlook: Array<{ date: string; sfi: number; a: number; kp: number }>;
  fetchedAt: number | null;
  ok: boolean;
}

const EMPTY: SpaceWeather = {
  kpNow: null,
  kpTime: null,
  aIndex: null,
  sfi: null,
  flareClass: null,
  flareTime: null,
  blackout: null,
  outlook: [],
  fetchedAt: null,
  ok: false,
};

/**
 * Récupère la météo spatiale NOAA temps réel (Kp, SFI, éruptions, 27-day).
 * Rafraîchie toutes les 5 minutes (les données NOAA évoluent lentement).
 */
export function useSpaceWeather(): { sw: SpaceWeather; solarInputs: SolarInputs } {
  const q = trpc.spots.spaceWeather.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const sw: SpaceWeather = q.data
    ? {
        kpNow: q.data.kpNow,
        kpTime: q.data.kpTime,
        aIndex: (q.data as { aIndex?: number | null }).aIndex ?? null,
        sfi: q.data.sfi,
        flareClass: q.data.flareClass,
        flareTime: q.data.flareTime,
        blackout: q.data.blackout,
        outlook: q.data.outlook ?? [],
        fetchedAt: q.data.fetchedAt,
        ok: q.data.ok,
      }
    : EMPTY;

  const solarInputs: SolarInputs = {
    kp: sw.kpNow,
    sfi: sw.sfi,
    flareClass: sw.flareClass,
    blackout: sw.blackout,
  };

  return { sw, solarInputs };
}
