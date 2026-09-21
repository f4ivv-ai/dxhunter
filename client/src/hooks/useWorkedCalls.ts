/**
 * Hook pour gérer les indicatifs "FAIT" et "HORS BANDE" (HB).
 * - FAIT : masque l'indicatif entièrement (toutes fréquences)
 * - HB : masque uniquement ce spot à cette fréquence (si l'indicatif revient sur une autre fréquence, il reste visible)
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useVisitorId } from "./useVisitorId";
import { toast } from "sonner";

export function useWorkedCalls() {
  const visitorId = useVisitorId();

  // === FAIT ===
  const { data: workedList, refetch: refetchWorked } = trpc.worked.list.useQuery(
    { visitorId },
    { enabled: !!visitorId, staleTime: 30_000 }
  );

  const addMutation = trpc.worked.add.useMutation({
    onSuccess: () => refetchWorked(),
  });

  const removeMutation = trpc.worked.remove.useMutation({
    onSuccess: () => refetchWorked(),
  });

  // === HORS BANDE ===
  const { data: oobList, refetch: refetchOob } = trpc.worked.listOob.useQuery(
    { visitorId },
    { enabled: !!visitorId, staleTime: 30_000 }
  );

  const addOobMutation = trpc.worked.addOob.useMutation({
    onSuccess: () => refetchOob(),
  });

  const removeOobMutation = trpc.worked.removeOob.useMutation({
    onSuccess: () => refetchOob(),
  });

  // Set de "CALL|BAND" pour lookup rapide (FAIT)
  const workedSet = useMemo(() => {
    const s = new Set<string>();
    if (workedList) {
      for (const w of workedList) {
        if (w.band) s.add(`${w.dxCall}|${w.band}`);
        s.add(w.dxCall);
      }
    }
    return s;
  }, [workedList]);

  // Set de "CALL|FREQ" pour lookup rapide (HB)
  const oobSet = useMemo(() => {
    const s = new Set<string>();
    if (oobList) {
      for (const o of oobList) {
        s.add(`${o.dxCall}|${o.freqKhz}`);
      }
    }
    return s;
  }, [oobList]);

  // === Actions FAIT ===
  const markWorked = (dxCall: string, band?: string) => {
    if (!visitorId) return;
    const call = dxCall.toUpperCase().trim();
    const already = isWorked(call, band);

    if (already) {
      removeMutation.mutate({ visitorId, dxCall: call, band });
      toast(`${call} retiré des FAIT`, {
        description: band ? `Bande ${band}` : "Toutes bandes",
        duration: 3000,
      });
    } else {
      addMutation.mutate({ visitorId, dxCall: call, band });
      toast(`✓ ${call} marqué FAIT`, {
        description: band ? `Bande ${band}` : "Toutes bandes",
        duration: 5000,
        action: {
          label: "Annuler",
          onClick: () => {
            removeMutation.mutate({ visitorId, dxCall: call, band });
          },
        },
      });
    }
  };

  const unmarkWorked = (dxCall: string, band?: string) => {
    if (!visitorId) return;
    removeMutation.mutate({ visitorId, dxCall, band });
  };

  const isWorked = (dxCall: string, band?: string): boolean => {
    if (band && workedSet.has(`${dxCall.toUpperCase()}|${band}`)) return true;
    return workedSet.has(dxCall.toUpperCase());
  };

  // === Actions HORS BANDE ===
  const markOob = (dxCall: string, freqKhz: number) => {
    if (!visitorId) return;
    const call = dxCall.toUpperCase().trim();
    const already = isOob(call, freqKhz);

    if (already) {
      removeOobMutation.mutate({ visitorId, dxCall: call, freqKhz });
      toast(`${call} retiré des HB`, {
        description: `Fréquence ${(freqKhz / 1000).toFixed(1)} MHz rétablie`,
        duration: 3000,
      });
    } else {
      addOobMutation.mutate({ visitorId, dxCall: call, freqKhz });
      toast(`⊘ ${call} marqué HORS BANDE`, {
        description: `${(freqKhz / 1000).toFixed(1)} MHz — masqué du flux`,
        duration: 5000,
        action: {
          label: "Annuler",
          onClick: () => {
            removeOobMutation.mutate({ visitorId, dxCall: call, freqKhz });
          },
        },
      });
    }
  };

  const isOob = (dxCall: string, freqKhz: number): boolean => {
    return oobSet.has(`${dxCall.toUpperCase()}|${freqKhz}`);
  };

  return {
    workedSet,
    oobSet,
    workedList: workedList ?? [],
    oobList: oobList ?? [],
    workedCount: workedList?.length ?? 0,
    oobCount: oobList?.length ?? 0,
    markWorked,
    unmarkWorked,
    isWorked,
    markOob,
    isOob,
    isLoading: addMutation.isPending || removeMutation.isPending || addOobMutation.isPending || removeOobMutation.isPending,
  };
}
