/**
 * Contest Mode Router — gestion des sessions de concours et coloration des spots.
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contestSessions, contestQsos } from "../../drizzle/schema";
import { eq, and, desc, count } from "drizzle-orm";
import {
  CONTESTS,
  listContests,
  getSpotStatus,
  extractWpxPrefix,
  extractCountryPrefix,
  guessCqZone,
  extractIotaRef,
  type WorkedData,
  type SpotInfo,
} from "../contestRules";
import { scpSearch, scpCount } from "../scp";
import { qrzLookup } from "../qrz";

export const contestRouter = router({
  /** Liste les concours disponibles */
  listContests: publicProcedure.query(() => {
    return listContests();
  }),

  /** Récupère la session de concours active */
  getSession: publicProcedure.query(async () => {
    const db = (await getDb())!;
    const [session] = await db
      .select()
      .from(contestSessions)
      .where(eq(contestSessions.active, 1))
      .orderBy(desc(contestSessions.createdAt))
      .limit(1);
    return session || null;
  }),

  /** Démarre une nouvelle session de concours */
  startSession: protectedProcedure
    .input(
      z.object({
        contestId: z.string(),
        category: z.enum(["MULTI_ONE", "SINGLE_OP"]),
        power: z.enum(["HIGH", "LOW", "QRP"]).default("HIGH"),
        mycall: z.string().default("F4IVV"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      // Désactiver toute session existante
      await db
        .update(contestSessions)
        .set({ active: 0 })
        .where(eq(contestSessions.active, 1));

      // Créer la nouvelle session
      const [result] = await db.insert(contestSessions).values({
        contestId: input.contestId,
        category: input.category,
        power: input.power,
        mycall: input.mycall,
        startTime: Date.now(),
        active: 1,
      });

      return { id: result.insertId, contestId: input.contestId };
    }),

  /** Termine la session de concours active */
  endSession: protectedProcedure.mutation(async () => {
    const db = (await getDb())!;
    await db
      .update(contestSessions)
      .set({ active: 0, endTime: Date.now() })
      .where(eq(contestSessions.active, 1));
    return { success: true };
  }),

  /** Récupère les données de travail pour la coloration des spots */
  getWorkedData: publicProcedure.query(async () => {
    const db = (await getDb())!;
    // Trouver la session active
    const [session] = await db
      .select()
      .from(contestSessions)
      .where(eq(contestSessions.active, 1))
      .limit(1);

    if (!session) {
      return { active: false, contestId: null, worked: null };
    }

    // Charger tous les QSOs non-supprimés de cette session
    const qsos = await db
      .select({
        call: contestQsos.call,
        band: contestQsos.band,
        multiType: contestQsos.multiType,
        multiValue: contestQsos.multiValue,
      })
      .from(contestQsos)
      .where(
        and(
          eq(contestQsos.sessionId, session.id),
          eq(contestQsos.deleted, 0),
        ),
      );

    // Construire les sets de données
    const callsByBand: Record<string, string[]> = {};
    const multKeys: string[] = [];

    for (const qso of qsos) {
      if (!callsByBand[qso.band]) callsByBand[qso.band] = [];
      callsByBand[qso.band].push(qso.call.toUpperCase());

      if (qso.multiType && qso.multiValue) {
        multKeys.push(`${qso.band}:${qso.multiType}:${qso.multiValue}`);
      }
    }

    return {
      active: true,
      contestId: session.contestId,
      category: session.category,
      mycall: session.mycall,
      qsoCount: qsos.length,
      worked: { callsByBand, multKeys },
    };
  }),

  /** Détermine le statut d'un lot de spots (multi/done/todo) */
  spotStatuses: publicProcedure
    .input(
      z.object({
        spots: z.array(
          z.object({
            call: z.string(),
            band: z.string(),
            countryPrefix: z.string().optional(),
            cqZone: z.number().optional(),
            wpxPrefix: z.string().optional(),
            continent: z.string().optional(),
          }),
        ),
      }),
    )
    .query(async ({ input }) => {
      const db = (await getDb())!;
      // Trouver la session active
      const [session] = await db
        .select()
        .from(contestSessions)
        .where(eq(contestSessions.active, 1))
        .limit(1);

      if (!session) {
        return { active: false, statuses: [] };
      }

      // Charger les données de travail
      const qsos = await db
        .select({
          call: contestQsos.call,
          band: contestQsos.band,
          multiType: contestQsos.multiType,
          multiValue: contestQsos.multiValue,
        })
        .from(contestQsos)
        .where(
          and(
            eq(contestQsos.sessionId, session.id),
            eq(contestQsos.deleted, 0),
          ),
        );

      const callsByBand: Record<string, Set<string>> = {};
      const multKeys = new Set<string>();

      for (const qso of qsos) {
        if (!callsByBand[qso.band]) callsByBand[qso.band] = new Set();
        callsByBand[qso.band].add(qso.call.toUpperCase());
        if (qso.multiType && qso.multiValue) {
          multKeys.add(`${qso.band}:${qso.multiType}:${qso.multiValue}`);
        }
      }

      const worked: WorkedData = { callsByBand, multKeys };

      // Calculer le statut de chaque spot
      const statuses = input.spots.map((spot) =>
        getSpotStatus(spot as SpotInfo, session.contestId, worked),
      );

      return { active: true, contestId: session.contestId, statuses };
    }),

  /** Liste les derniers QSOs de la session active (carnet de trafic) */
  listQsos: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [session] = await db
        .select()
        .from(contestSessions)
        .where(eq(contestSessions.active, 1))
        .limit(1);

      if (!session) return { qsos: [], contestId: null };

      const limit = input?.limit || 50;
      const qsos = await db
        .select({
          id: contestQsos.id,
          call: contestQsos.call,
          band: contestQsos.band,
          mode: contestQsos.mode,
          freqKhz: contestQsos.freqKhz,
          qsoTime: contestQsos.qsoTime,
          rstSent: contestQsos.rstSent,
          rstRcvd: contestQsos.rstRcvd,
          exchangeSent: contestQsos.exchangeSent,
          exchangeRcvd: contestQsos.exchangeRcvd,
          cqZone: contestQsos.cqZone,
          countryPrefix: contestQsos.countryPrefix,
          wpxPrefix: contestQsos.wpxPrefix,
          continent: contestQsos.continent,
          isNewMulti: contestQsos.isNewMulti,
          multiType: contestQsos.multiType,
          multiValue: contestQsos.multiValue,
          isRunQso: contestQsos.isRunQso,
        })
        .from(contestQsos)
        .where(
          and(
            eq(contestQsos.sessionId, session.id),
            eq(contestQsos.deleted, 0),
          ),
        )
        .orderBy(desc(contestQsos.id))
        .limit(limit);

      return { qsos, contestId: session.contestId };
    }),

  /** Saisie manuelle d'un QSO (log intégré) */
  logQso: protectedProcedure
    .input(
      z.object({
        call: z.string().min(1),
        band: z.string(),
        mode: z.string().default("SSB"),
        freqKhz: z.number().optional(),
        rstSent: z.string().default("59"),
        rstRcvd: z.string().default("59"),
        exchangeSent: z.string().optional(),
        exchangeRcvd: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const [session] = await db
        .select()
        .from(contestSessions)
        .where(eq(contestSessions.active, 1))
        .limit(1);

      if (!session) throw new Error("Aucune session contest active");

      const contest = CONTESTS[session.contestId];
      const call = input.call.toUpperCase().trim();
      const countryPrefix = extractCountryPrefix(call);
      const wpxPrefix = extractWpxPrefix(call);
      const cqZone = guessCqZone(countryPrefix);

      // Numéro de série auto-incrémenté
      const [countResult] = await db
        .select({ cnt: count() })
        .from(contestQsos)
        .where(
          and(
            eq(contestQsos.sessionId, session.id),
            eq(contestQsos.deleted, 0),
          ),
        );
      const serialNr = (countResult?.cnt || 0) + 1;
      const exchangeSent = input.exchangeSent || String(serialNr).padStart(3, "0");

      // Détection multiplicateur
      let multiType: string | null = null;
      let multiValue: string | null = null;
      let isNewMulti = 0;

      if (contest) {
        const exchange = input.exchangeRcvd || "";
        const spotInfo: SpotInfo = {
          call,
          band: input.band,
          mode: input.mode,
          countryPrefix,
          cqZone,
          wpxPrefix,
          exchange,
          department: exchange,
          state: exchange,
          iotaRef: extractIotaRef(exchange) || undefined,
          comment: "",
        };

        const candidates = contest.extractMultipliers(spotInfo);
        for (const cand of candidates) {
          const existing = await db
            .select({ id: contestQsos.id })
            .from(contestQsos)
            .where(
              and(
                eq(contestQsos.sessionId, session.id),
                eq(contestQsos.deleted, 0),
                eq(contestQsos.band, cand.band),
                eq(contestQsos.multiType, cand.type),
                eq(contestQsos.multiValue, cand.value),
              ),
            )
            .limit(1);

          if (existing.length === 0) {
            isNewMulti = 1;
            multiType = cand.type;
            multiValue = cand.value;
            break;
          }
        }
      }

      // Détection dupe
      const dupeCheck = await db
        .select({ id: contestQsos.id })
        .from(contestQsos)
        .where(
          and(
            eq(contestQsos.sessionId, session.id),
            eq(contestQsos.deleted, 0),
            eq(contestQsos.call, call),
            eq(contestQsos.band, input.band),
          ),
        )
        .limit(1);
      const isDupe = dupeCheck.length > 0;

      // Insérer le QSO
      await db.insert(contestQsos).values({
        sessionId: session.id,
        call,
        band: input.band,
        mode: input.mode,
        freqKhz: input.freqKhz || null,
        qsoTime: Date.now(),
        rstSent: input.rstSent,
        rstRcvd: input.rstRcvd,
        exchangeSent,
        exchangeRcvd: input.exchangeRcvd || null,
        cqZone: cqZone || null,
        countryPrefix: countryPrefix || null,
        wpxPrefix: wpxPrefix || null,
        continent: null,
        isNewMulti,
        multiType,
        multiValue,
        stationName: null,
        isRunQso: 0,
        externalId: null,
      });

      console.log(
        `[Contest] Manual QSO #${serialNr}: ${call} ${input.band}m ${input.mode}${isNewMulti ? ` ★ MULTI ${multiType}=${multiValue}` : ""}${isDupe ? " [DUPE]" : ""}`,
      );

      return { ok: true, serialNr, isNewMulti, multiType, multiValue, isDupe };
    }),

  /** Supprime un QSO (soft delete) */
  deleteQso: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db
        .update(contestQsos)
        .set({ deleted: 1 })
        .where(eq(contestQsos.id, input.id));
      return { ok: true };
    }),

  /** Stats du concours en cours */
  stats: publicProcedure.query(async () => {
    const db = (await getDb())!;
    const [session] = await db
      .select()
      .from(contestSessions)
      .where(eq(contestSessions.active, 1))
      .limit(1);

    if (!session) return null;

    const qsos = await db
      .select({
        band: contestQsos.band,
        multiType: contestQsos.multiType,
        multiValue: contestQsos.multiValue,
        isNewMulti: contestQsos.isNewMulti,
      })
      .from(contestQsos)
      .where(
        and(
          eq(contestQsos.sessionId, session.id),
          eq(contestQsos.deleted, 0),
        ),
      );

    // Compter QSOs par bande
    const qsosByBand: Record<string, number> = {};
    const multsByBand: Record<string, Set<string>> = {};

    for (const qso of qsos) {
      qsosByBand[qso.band] = (qsosByBand[qso.band] || 0) + 1;
      if (qso.multiType && qso.multiValue) {
        const key = `${qso.multiType}:${qso.multiValue}`;
        if (!multsByBand[qso.band]) multsByBand[qso.band] = new Set();
        multsByBand[qso.band].add(key);
      }
    }

    const contest = CONTESTS[session.contestId];
    const bands = contest?.bands || ["160", "80", "40", "20", "15", "10"];

    const bandStats = bands.map((band) => ({
      band,
      qsos: qsosByBand[band] || 0,
      mults: multsByBand[band]?.size || 0,
    }));

    const totalQsos = qsos.length;
    const totalMults = new Set(
      qsos
        .filter((q: any) => q.multiType && q.multiValue)
        .map((q: any) => `${q.band}:${q.multiType}:${q.multiValue}`),
    ).size;

    return {
      contestId: session.contestId,
      contestName: contest?.name || session.contestId,
      category: session.category,
      mycall: session.mycall,
      totalQsos,
      totalMults,
      bandStats,
    };
  }),

  /** Super Check Partial — recherche d'indicatifs partiels */
  scp: publicProcedure
    .input(z.object({ partial: z.string().min(2).max(20) }))
    .query(({ input }) => {
      return { matches: scpSearch(input.partial, 12) };
    }),

  /** QRZ.com lookup — infos complètes d'un indicatif */
  qrzLookup: publicProcedure
    .input(z.object({ call: z.string().min(2).max(20) }))
    .query(async ({ input }) => {
      const info = await qrzLookup(input.call);
      return { info };
    }),

  /** Nombre d'indicatifs dans la base SCP */
  scpInfo: publicProcedure.query(() => {
    return { count: scpCount() };
  }),
});
