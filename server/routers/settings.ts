/**
 * Router tRPC pour les paramètres utilisateur (objectif DXCC, etc.)
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const settingsRouter = router({
  /** Récupérer les paramètres du visiteur */
  get: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.visitorId, input.visitorId))
        .limit(1);
      return rows[0] ?? { visitorId: input.visitorId, dxccGoal: 100 };
    }),

  /** Mettre à jour l'objectif DXCC */
  setDxccGoal: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        dxccGoal: z.number().int().min(1).max(340),
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      // Upsert : insert ou update si déjà présent
      await db
        .insert(userSettings)
        .values({ visitorId: input.visitorId, dxccGoal: input.dxccGoal })
        .onDuplicateKeyUpdate({ set: { dxccGoal: input.dxccGoal } });
      return { ok: true, dxccGoal: input.dxccGoal };
    }),
});
