/**
 * rotorRelay — Proxy tRPC vers l'application rotor externe (arcorotctrl).
 *
 * L'application rotor tourne sur https://arcorotctrl-dkbitpc4.manus.space
 * et expose une API tRPC. Ce router proxifie les appels depuis DX Hunter
 * pour éviter les problèmes CORS côté navigateur.
 */
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";

const ROTOR_BASE = "https://arcorotctrl-dkbitpc4.manus.space/api/trpc";

/** Appel générique vers l'API tRPC du rotor */
async function rotorGet<T>(procedure: string): Promise<T> {
  const url = `${ROTOR_BASE}/${procedure}?batch=1&input=%7B%7D`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Rotor API error: ${res.status}`);
  const json = await res.json();
  // tRPC batch response: [{result:{data:{json:{...}}}}]
  return json[0]?.result?.data?.json as T;
}

async function rotorPost<T>(procedure: string, payload: unknown): Promise<T> {
  const url = `${ROTOR_BASE}/${procedure}?batch=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "0": { json: payload } }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Rotor API error: ${res.status}`);
  const json = await res.json();
  return json[0]?.result?.data?.json as T;
}

export interface RotorState {
  azimuth: number;
  status: string;
  config?: { host: string; port: number };
}

export const rotorRelayRouter = router({
  /** Lire l'état actuel du rotor (azimut + statut) */
  state: publicProcedure.query(async () => {
    try {
      const data = await rotorGet<RotorState>("rotator.getState");
      return {
        azimuth: data?.azimuth ?? 0,
        status: data?.status ?? "unknown",
        connected: data?.status === "connected" || data?.status === "rotating",
        reachable: true,
      };
    } catch {
      return { azimuth: 0, status: "unreachable", connected: false, reachable: false };
    }
  }),

  /** Envoyer le rotor vers un azimut donné (admin uniquement) */
  goTo: adminProcedure
    .input(z.object({ azimuth: z.number().min(0).max(360) }))
    .mutation(async ({ input }) => {
      try {
        await rotorPost("rotator.goTo", { azimuth: input.azimuth });
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }),

  /** Arrêter le rotor (admin uniquement) */
  stop: adminProcedure.mutation(async () => {
    try {
      await rotorPost("rotator.stop", {});
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }),
});
