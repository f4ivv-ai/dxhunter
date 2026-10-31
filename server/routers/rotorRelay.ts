/**
 * rotorRelay — Proxy tRPC vers l'application rotor externe (arcorotctrl).
 *
 * L'application rotor (arcorotctrl) expose une API tRPC. Son adresse est
 * donnée par ROTOR_API_URL (ex. https://rotor.exemple.fr/api/trpc).
 * Vide = rotor désactivé. Ce router proxifie les appels pour éviter le CORS.
 */
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";

function rotorBase(): string {
  if (!ENV.rotorApiUrl) throw new Error("Rotor non configuré (ROTOR_API_URL)");
  return ENV.rotorApiUrl;
}

/** Adresse de l'interface web du rotor, déduite de l'URL de son API. */
export function rotorUiUrl(apiUrl = ENV.rotorApiUrl): string | null {
  if (!apiUrl) return null;
  return apiUrl.replace(/\/api\/trpc$/, "");
}

/** Appel générique vers l'API tRPC du rotor */
async function rotorGet<T>(procedure: string): Promise<T> {
  const url = `${rotorBase()}/${procedure}?batch=1&input=%7B%7D`;
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
  const url = `${rotorBase()}/${procedure}?batch=1`;
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
  /** Rotor configuré ? + lien vers son interface */
  info: publicProcedure.query(() => ({
    enabled: Boolean(ENV.rotorApiUrl),
    uiUrl: rotorUiUrl(),
  })),

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
