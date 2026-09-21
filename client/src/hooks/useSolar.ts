import { trpc } from "@/lib/trpc";

const SOLAR_POLL_MS = 10 * 60 * 1000; // 10 min

export interface HfConditions {
  [key: string]: string; // ex "80m-40m-day": "Good"
}

export interface SolarData {
  updated: number;
  sfi: number;
  a_index: number;
  k_index: number;
  xray: string;
  sunspots: number;
  aurora: number;
  geomag_field: string;
  solar_wind: number;
  hf_conditions: HfConditions;
}

export interface UseSolarResult {
  solar: SolarData | null;
  ok: boolean;
  loading: boolean;
}

/** Récupère les conditions solaires / de propagation (rafraîchies toutes les 10 min). */
export function useSolar(): UseSolarResult {
  const query = trpc.spots.solar.useQuery(undefined, {
    refetchInterval: SOLAR_POLL_MS,
    staleTime: SOLAR_POLL_MS,
    refetchOnWindowFocus: false,
  });

  const solar = (query.data?.ok ? (query.data.data as SolarData) : null) ?? null;

  return {
    solar,
    ok: !!query.data?.ok,
    loading: query.isLoading,
  };
}
