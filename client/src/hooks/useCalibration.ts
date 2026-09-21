import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export interface CalibRow {
  id: number;
  snapDate: string;
  hourUtc: number;
  zoneId: string;
  zoneLabel: string | null;
  predictedScore: number;
  actualSpots: number;
  actualScore: number;
  error: number;
  kp: number | null;
  sfi: number | null;
  aIndex: number | null;
  source: "auto" | "manual";
}

export interface Accuracy {
  mae: number;
  bias: number;
  reliability: number;
}

/** Agrégat par jour : fiabilité moyenne, nb de créneaux, statut. */
export interface DaySummary {
  date: string;
  rows: CalibRow[];
  accuracy: Accuracy;
  slots: number; // nb de captures distinctes (couples date+heure)
  dToContest: number; // J-n par rapport au 11/07/2026
}

const CONTEST_DAY = "2026-07-11";

function accuracyOf(rows: { error: number }[]): Accuracy {
  if (rows.length === 0) return { mae: 0, bias: 0, reliability: 0 };
  let sumAbs = 0;
  let sum = 0;
  for (const r of rows) {
    sumAbs += Math.abs(r.error);
    sum += r.error;
  }
  const mae = sumAbs / rows.length;
  const bias = sum / rows.length;
  const reliability = Math.max(0, Math.min(100, Math.round(100 - (mae / 60) * 100)));
  return { mae: Math.round(mae), bias: Math.round(bias), reliability };
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round((db - da) / 86400_000);
}

/**
 * Récupère les snapshots de calibration et les regroupe par jour pour le
 * tableau d'entraînement J-12 → J-0. Expose aussi la mutation de capture.
 */
export function useCalibration(days = 14) {
  const utils = trpc.useUtils();
  const q = trpc.spots.listCalibration.useQuery(
    { days },
    { refetchInterval: 60_000, staleTime: 30_000 },
  );

  const run = trpc.spots.runCalibration.useMutation({
    onSuccess: () => {
      utils.spots.listCalibration.invalidate();
    },
  });

  const rows = (q.data?.rows ?? []) as CalibRow[];
  const global = (q.data?.accuracy ?? { mae: 0, bias: 0, reliability: 0 }) as Accuracy;

  const byDay = useMemo<DaySummary[]>(() => {
    const map = new Map<string, CalibRow[]>();
    for (const r of rows) {
      if (!map.has(r.snapDate)) map.set(r.snapDate, []);
      map.get(r.snapDate)!.push(r);
    }
    const out: DaySummary[] = [];
    for (const [date, list] of Array.from(map.entries())) {
      const slotKeys = new Set(list.map((r: CalibRow) => `${r.hourUtc}`));
      out.push({
        date,
        rows: list,
        accuracy: accuracyOf(list),
        slots: slotKeys.size,
        dToContest: daysBetween(date, CONTEST_DAY),
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [rows]);

  return {
    rows,
    byDay,
    global,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    run,
  };
}
