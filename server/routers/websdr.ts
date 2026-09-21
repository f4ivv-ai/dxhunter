/**
 * WebSDR Router — Gestion des favoris, supprimés, et sélection intelligente.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  addFavorite,
  removeFavorite,
  addDeleted,
  removeDeleted,
  listFavorites,
  listDeleted,
  findBestSdrsForDx,
  findSmartCorridorSdrs,
} from "../websdrSmart";
import { locatorToLatLon } from "../websdr";

export const websdrRouter = router({
  /** Liste les favoris du visiteur. */
  listFavorites: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const favs = await listFavorites(input.visitorId);
      return { ok: true as const, favorites: favs };
    }),

  /** Liste les SDR supprimés du visiteur. */
  listDeleted: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const dels = await listDeleted(input.visitorId);
      return { ok: true as const, deleted: dels };
    }),

  /** Ajouter un SDR aux favoris. */
  addFavorite: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        sdrName: z.string().min(1),
        sdrUrl: z.string().min(1),
        lat: z.number().optional(),
        lon: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const ok = await addFavorite(input.visitorId, input.sdrName, input.sdrUrl, input.lat, input.lon);
      return { ok };
    }),

  /** Retirer un SDR des favoris. */
  removeFavorite: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        sdrName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const ok = await removeFavorite(input.visitorId, input.sdrName);
      return { ok };
    }),

  /** Supprimer un SDR (ne réapparaîtra plus). */
  deleteSdr: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        sdrName: z.string().min(1),
        sdrUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const ok = await addDeleted(input.visitorId, input.sdrName, input.sdrUrl);
      return { ok };
    }),

  /** Restaurer un SDR supprimé. */
  restoreDeleted: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        sdrName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const ok = await removeDeleted(input.visitorId, input.sdrName);
      return { ok };
    }),

  /** Sélection intelligente : meilleurs SDR pour un DX donné. */
  bestForDx: publicProcedure
    .input(
      z.object({
        dxCall: z.string(),
        freqKhz: z.number(),
        mode: z.string().optional(),
        dxLat: z.number().optional(),
        dxLon: z.number().optional(),
        visitorId: z.string().nullable().optional(),
        maxResults: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const result = await findBestSdrsForDx(
        input.dxCall,
        input.freqKhz,
        input.mode,
        input.dxLat,
        input.dxLon,
        input.visitorId ?? null,
        input.maxResults,
      );
      return { ok: true as const, ...result };
    }),

  /** Poster un spot sur DX Summit. */
  postSpot: publicProcedure
    .input(
      z.object({
        deCall: z.string().min(1).max(15),
        dxCall: z.string().min(1).max(15),
        frequency: z.string().min(1),
        info: z.string().max(60).default(""),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const resp = await fetch("http://www.dxsummit.fi/api/v1/spots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            de_call: input.deCall,
            dx_call: input.dxCall,
            frequency: input.frequency,
            info: input.info,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) {
          return { ok: false as const, error: `DX Summit HTTP ${resp.status}` };
        }
        const data = await resp.json() as { status?: string };
        return { ok: data.status === "ok", error: data.status !== "ok" ? "Réponse inattendue" : undefined };
      } catch (e: any) {
        return { ok: false as const, error: e.message ?? "Erreur réseau" };
      }
    }),

  /** Sélection intelligente : SDR le long d'un corridor (Self-Monitor). */
  smartCorridor: publicProcedure
    .input(
      z.object({
        freqKhz: z.number().min(1800).max(30000),
        azimut: z.number().min(0).max(360),
        path: z.enum(["SP", "LP"]),
        mode: z.string().optional(),
        visitorId: z.string().nullable().optional(),
        locator: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let qthLat: number | undefined;
      let qthLon: number | undefined;
      if (input.locator) {
        const pos = locatorToLatLon(input.locator);
        if (pos) { qthLat = pos.lat; qthLon = pos.lon; }
      }
      const result = await findSmartCorridorSdrs(
        input.freqKhz,
        input.azimut,
        input.path,
        input.mode,
        input.visitorId ?? null,
        qthLat,
        qthLon,
      );
      return { ok: true as const, ...result };
    }),
});
