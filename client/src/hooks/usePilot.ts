import { useCallback, useEffect, useMemo, useState } from "react";
import { Spot } from "@/lib/dx";
import {
  buildMultStatus,
  buildRecommendations,
  buildTimeline,
  rollingWindow,
  Recommendation,
  MultStatus,
  TimelineSlot,
} from "@/lib/pilot";
import { SolarInputs } from "@/lib/propagation";

const LS_ITU = "tm0hq-worked-itu";
const LS_HQ = "tm0hq-worked-hq";

function loadSet<T extends string | number>(key: string, cast: (v: string) => T): Set<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set((JSON.parse(raw) as string[]).map(cast));
  } catch {
    return new Set();
  }
}

export interface UsePilotResult {
  recommendations: Recommendation[];
  multStatus: MultStatus;
  timeline: TimelineSlot[];
  window: ReturnType<typeof rollingWindow>;
  workedItu: Set<number>;
  workedHq: Set<string>;
  toggleItu: (zone: number) => void;
  toggleHq: (abbr: string) => void;
  /** horloge interne qui force le recalcul (rafraîchissement) */
  tick: number;
}

/**
 * Hook central de pilotage : recalcule les recommandations et la timeline à
 * partir des spots 40 m, du K index et des multiplicateurs travaillés (persistés).
 */
export function usePilot(spots40: Spot[], solar: SolarInputs, qth?: { lat: number; lon: number }): UsePilotResult {
  const [workedItu, setWorkedItu] = useState<Set<number>>(() =>
    loadSet(LS_ITU, (v) => Number(v))
  );
  const [workedHq, setWorkedHq] = useState<Set<string>>(() => loadSet(LS_HQ, (v) => v));
  const [tick, setTick] = useState(0);

  // recalcul périodique (toutes les 60 s) pour suivre la progression du temps
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const toggleItu = useCallback((zone: number) => {
    setWorkedItu((prev) => {
      const next = new Set(prev);
      next.has(zone) ? next.delete(zone) : next.add(zone);
      localStorage.setItem(LS_ITU, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const toggleHq = useCallback((abbr: string) => {
    setWorkedHq((prev) => {
      const next = new Set(prev);
      next.has(abbr) ? next.delete(abbr) : next.add(abbr);
      localStorage.setItem(LS_HQ, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const now = useMemo(() => new Date(), [tick, spots40.length]);
  // clé de stabilité : recalcul quand le solaire change significativement
  const solarKey = `${solar.kp ?? -1}|${solar.sfi ?? -1}|${solar.blackout ?? ""}`;

  const recommendations = useMemo(
    () => buildRecommendations(spots40, workedItu, workedHq, solar, now, qth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spots40, workedItu, workedHq, solarKey, now, qth]
  );

  const multStatus = useMemo(
    () => buildMultStatus(spots40, workedItu, workedHq),
    [spots40, workedItu, workedHq]
  );

  const timeline = useMemo(
    () => buildTimeline(solar, qth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solarKey, qth]
  );

  const window = useMemo(() => rollingWindow(now), [now]);

  return {
    recommendations,
    multStatus,
    timeline,
    window,
    workedItu,
    workedHq,
    toggleItu,
    toggleHq,
    tick,
  };
}
