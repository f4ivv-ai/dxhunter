import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { RawSpot, Spot, toSpot, ALL_BANDS } from "@/lib/dx";

const POLL_MS = 12_000;
const MAX_SPOTS = 600;

export type ConnState = "connecting" | "online" | "error";

interface UseSpotsResult {
  spots: Spot[];
  conn: ConnState;
  lastUpdate: number | null;
  newIds: Set<string>;
  refresh: () => void;
}

/**
 * Récupère en continu les spots DX via le proxy backend (tRPC -> Spothole).
 * Conserve uniquement les bandes HF suivies (160..10 m). Rafraîchi toutes les 12 s.
 */
export function useSpots(targets: string[] = []): UseSpotsResult {
  const query = trpc.spots.list.useQuery(
    { maxAge: 7200, limit: 500 },
    {
      refetchInterval: POLL_MS,
      refetchOnWindowFocus: true,
      staleTime: POLL_MS,
    }
  );

  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const targetsKey = targets.join("|").toUpperCase();
  const spots = useMemo<Spot[]>(() => {
    const raw = (query.data?.spots ?? []) as unknown as RawSpot[];
    return raw
      .filter((r) => r && r.dx_call && r.band && ALL_BANDS.includes(r.band as any))
      .map((r) => toSpot(r, targets))
      .sort((a, b) => b.received_time - a.received_time)
      .slice(0, MAX_SPOTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, targetsKey]);

  // Détection des nouveaux spots à chaque arrivée de données
  useEffect(() => {
    if (!query.data) return;
    const fresh = new Set<string>();
    if (!firstLoad.current) {
      for (const s of spots) {
        if (!seen.current.has(s.id)) fresh.add(s.id);
      }
    }
    for (const s of spots) seen.current.add(s.id);
    if (seen.current.size > 4000) {
      seen.current = new Set(spots.map((s) => s.id));
    }
    firstLoad.current = false;
    setNewIds(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.dataUpdatedAt]);

  let conn: ConnState = "connecting";
  if (query.isError || query.data?.ok !== true) conn = "error";
  else if (query.data?.ok) conn = "online";

  return {
    spots,
    conn,
    lastUpdate: query.dataUpdatedAt || null,
    newIds,
    refresh: () => query.refetch(),
  };
}
