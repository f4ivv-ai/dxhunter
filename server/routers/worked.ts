/**
 * Router tRPC pour la gestion des indicatifs "FAIT" (déjà contactés).
 * Permet de marquer un indicatif comme travaillé pendant un contest,
 * de le retirer, et de lister tous les indicatifs faits.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workedCalls, oobSpots } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const CURRENT_CONTEST = "IARU-HF-2026";

export const workedRouter = router({
  /** Marquer un indicatif comme "FAIT" sur une bande */
  add: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        dxCall: z.string().min(1),
        band: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const call = input.dxCall.toUpperCase().trim();
      const db = (await getDb())!;
      try {
        await db.insert(workedCalls).values({
          visitorId: input.visitorId,
          dxCall: call,
          band: input.band || null,
          contestId: CURRENT_CONTEST,
        });
      } catch (e: any) {
        // Duplicate — already marked, ignore
        if (e?.code === "ER_DUP_ENTRY" || e?.message?.includes("Duplicate")) {
          return { ok: true, alreadyExists: true };
        }
        throw e;
      }
      return { ok: true, alreadyExists: false };
    }),

  /** Retirer un indicatif de la liste "FAIT" */
  remove: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        dxCall: z.string().min(1),
        band: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const call = input.dxCall.toUpperCase().trim();
      const db = (await getDb())!;
      if (input.band) {
        await db
          .delete(workedCalls)
          .where(
            and(
              eq(workedCalls.visitorId, input.visitorId),
              eq(workedCalls.dxCall, call),
              eq(workedCalls.band, input.band),
              eq(workedCalls.contestId, CURRENT_CONTEST)
            )
          );
      } else {
        await db
          .delete(workedCalls)
          .where(
            and(
              eq(workedCalls.visitorId, input.visitorId),
              eq(workedCalls.dxCall, call),
              eq(workedCalls.contestId, CURRENT_CONTEST)
            )
          );
      }
      return { ok: true };
    }),

  /** Lister tous les indicatifs "FAIT" pour ce contest */
  list: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .select()
        .from(workedCalls)
        .where(
          and(
            eq(workedCalls.visitorId, input.visitorId),
            eq(workedCalls.contestId, CURRENT_CONTEST)
          )
        );
      return rows.map((r: { dxCall: string; band: string | null; createdAt: Date }) => ({
        dxCall: r.dxCall,
        band: r.band,
        createdAt: r.createdAt,
      }));
    }),

  // ===== HORS BANDE (HB) =====

  /** Marquer un spot comme Hors Bande (fréquence inaccessible) */
  addOob: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        dxCall: z.string().min(1),
        freqKhz: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const call = input.dxCall.toUpperCase().trim();
      const db = (await getDb())!;
      try {
        await db.insert(oobSpots).values({
          visitorId: input.visitorId,
          dxCall: call,
          freqKhz: input.freqKhz,
          contestId: CURRENT_CONTEST,
        });
      } catch (e: any) {
        if (e?.code === "ER_DUP_ENTRY" || e?.message?.includes("Duplicate")) {
          return { ok: true, alreadyExists: true };
        }
        throw e;
      }
      return { ok: true, alreadyExists: false };
    }),

  /** Retirer un spot de la liste Hors Bande */
  removeOob: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        dxCall: z.string().min(1),
        freqKhz: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const call = input.dxCall.toUpperCase().trim();
      const db = (await getDb())!;
      await db
        .delete(oobSpots)
        .where(
          and(
            eq(oobSpots.visitorId, input.visitorId),
            eq(oobSpots.dxCall, call),
            eq(oobSpots.freqKhz, input.freqKhz),
            eq(oobSpots.contestId, CURRENT_CONTEST)
          )
        );
      return { ok: true };
    }),

  /** Lister tous les spots Hors Bande pour ce contest */
  listOob: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .select()
        .from(oobSpots)
        .where(
          and(
            eq(oobSpots.visitorId, input.visitorId),
            eq(oobSpots.contestId, CURRENT_CONTEST)
          )
        );
      return rows.map((r) => ({
        dxCall: r.dxCall,
        freqKhz: r.freqKhz,
        createdAt: r.createdAt,
      }));
    }),
});
