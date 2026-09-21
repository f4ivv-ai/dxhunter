/**
 * Router tRPC pour le suivi DXCC.
 * Retourne les entités DXCC travaillées par le visiteur (par bande et mode).
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dxccWorked } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const dxccRouter = router({
  /** Retourner toutes les entités DXCC travaillées par le visiteur */
  getWorked: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        band: z.string().optional(),
        mode: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const conditions = [eq(dxccWorked.visitorId, input.visitorId)];
      if (input.band) conditions.push(eq(dxccWorked.band, input.band));
      if (input.mode) conditions.push(eq(dxccWorked.mode, input.mode.toUpperCase()));

      const rows = await db
        .select()
        .from(dxccWorked)
        .where(and(...conditions));

      return rows.map((r) => ({
        dxccCode: r.dxccCode,
        band: r.band,
        mode: r.mode,
        dxCall: r.dxCall,
        workedAt: r.workedAt,
      }));
    }),
});
