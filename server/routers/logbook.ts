/**
 * Router tRPC pour le journal de trafic (Logbook).
 * Permet d'enregistrer les QSO, de les lister, de les supprimer
 * et d'exporter en format ADIF compatible QRZ.com / LoTW.
 * Chaque ajout de QSO met automatiquement à jour le suivi DXCC.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { qsoLog, dxccWorked } from "../../drizzle/schema";
import { eq, and, desc, asc, count, countDistinct, like, gte, lte, sql } from "drizzle-orm";
import { findDxccByCallsign, findDxccByCountryName } from "../../shared/dxccEntities";

/** Normalise le mode pour ADIF */
function normalizeMode(mode: string): string {
  const m = mode.toUpperCase();
  if (m === "FT8" || m === "FT4") return m;
  if (m === "CW") return "CW";
  if (m === "SSB" || m === "USB" || m === "LSB") return "SSB";
  if (m === "AM") return "AM";
  if (m === "FM") return "FM";
  if (m === "RTTY") return "RTTY";
  return m;
}

/** RST par défaut selon le mode */
function defaultRst(mode: string): string {
  const m = mode.toUpperCase();
  if (m === "CW" || m === "RTTY" || m === "FT8" || m === "FT4") return "599";
  return "59";
}

/** Génère le contenu ADIF à partir d'une liste de QSO */
function generateAdif(qsos: Array<{
  dxCall: string;
  freqKhz: number;
  band: string;
  mode: string;
  dxCountry: string | null;
  rstSent: string | null;
  rstRcvd: string | null;
  qsoDateUtc: Date;
}>): string {
  const lines: string[] = [];
  lines.push("ADIF Export from DX Hunter");
  lines.push(`<ADIF_VER:5>3.1.0`);
  lines.push(`<PROGRAMID:9>DXHunter`);
  lines.push(`<EOH>`);
  lines.push("");

  for (const qso of qsos) {
    const date = qso.qsoDateUtc;
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = date.toISOString().slice(11, 16).replace(":", "");
    const call = qso.dxCall.toUpperCase();
    const freq = (qso.freqKhz / 1000).toFixed(3);
    const mode = normalizeMode(qso.mode);
    const band = qso.band.toLowerCase();
    const rstSent = qso.rstSent || defaultRst(qso.mode);
    const rstRcvd = qso.rstRcvd || defaultRst(qso.mode);
    const country = qso.dxCountry || "";

    const adifField = (tag: string, value: string) =>
      value ? `<${tag}:${value.length}>${value}` : "";

    const parts = [
      adifField("CALL", call),
      adifField("QSO_DATE", dateStr),
      adifField("TIME_ON", timeStr),
      adifField("FREQ", freq),
      adifField("BAND", band),
      adifField("MODE", mode),
      adifField("RST_SENT", rstSent),
      adifField("RST_RCVD", rstRcvd),
      country ? adifField("COUNTRY", country) : "",
      "<EOR>",
    ].filter(Boolean).join(" ");

    lines.push(parts);
  }

  return lines.join("\n");
}

export const logbookRouter = router({
  /** Ajouter un QSO au logbook + upsert DXCC */
  add: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        dxCall: z.string().min(1),
        freqKhz: z.number().positive(),
        band: z.string().min(1),
        mode: z.string().min(1),
        dxCountry: z.string().optional(),
        dxccCode: z.string().optional(),
        rstSent: z.string().optional(),
        rstRcvd: z.string().optional(),
        operatorName: z.string().optional(),
        notes: z.string().optional(),
        qsoDateUtc: z.string().optional(), // ISO string, defaults to now
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const call = input.dxCall.toUpperCase().trim();
      const mode = normalizeMode(input.mode);
      const rst = defaultRst(mode);
      const qsoDate = input.qsoDateUtc ? new Date(input.qsoDateUtc) : new Date();

      // Résoudre le DXCC si non fourni
      let dxccCode = input.dxccCode;
      let dxCountry = input.dxCountry;
      if (!dxccCode) {
        const entity = findDxccByCallsign(call);
        if (entity) {
          dxccCode = entity.code;
          dxCountry = dxCountry || entity.name;
        }
      }

      // Insérer le QSO
      const [result] = await db.insert(qsoLog).values({
        visitorId: input.visitorId,
        dxCall: call,
        freqKhz: input.freqKhz,
        band: input.band,
        mode,
        dxCountry: dxCountry || null,
        dxccCode: dxccCode || null,
        rstSent: input.rstSent || rst,
        rstRcvd: input.rstRcvd || rst,
        operatorName: input.operatorName || null,
        notes: input.notes || null,
        qsoDateUtc: qsoDate,
      });

      // Upsert DXCC si on a un code
      if (dxccCode) {
        try {
          await db.insert(dxccWorked).values({
            visitorId: input.visitorId,
            dxccCode,
            band: input.band,
            mode,
            dxCall: call,
            workedAt: qsoDate,
          });
        } catch (e: any) {
          // Duplicate (déjà travaillé sur cette bande/mode) — ignorer
          if (!e?.code?.includes("DUP") && !e?.message?.includes("Duplicate")) {
            throw e;
          }
        }
      }

      return { ok: true, dxccCode: dxccCode || null };
    }),

  /** Lister les QSO du visiteur (du plus récent au plus ancien) */
  list: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        band: z.string().optional(),
        mode: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional().default(200),
        offset: z.number().int().min(0).optional().default(0),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z.enum(["date", "call", "band", "mode", "freq"]).optional().default("date"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      })
    )
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const conditions = [eq(qsoLog.visitorId, input.visitorId)];
      if (input.band) conditions.push(eq(qsoLog.band, input.band));
      if (input.mode) conditions.push(eq(qsoLog.mode, normalizeMode(input.mode)));
      if (input.search) conditions.push(like(qsoLog.dxCall, `%${input.search.toUpperCase()}%`));
      if (input.dateFrom) conditions.push(gte(qsoLog.qsoDateUtc, new Date(input.dateFrom)));
      if (input.dateTo) {
        const to = new Date(input.dateTo);
        to.setHours(23, 59, 59, 999);
        conditions.push(lte(qsoLog.qsoDateUtc, to));
      }
      const sortCol = input.sortBy === "call" ? qsoLog.dxCall
        : input.sortBy === "band" ? qsoLog.band
        : input.sortBy === "mode" ? qsoLog.mode
        : input.sortBy === "freq" ? qsoLog.freqKhz
        : qsoLog.qsoDateUtc;
      const order = input.sortDir === "asc" ? asc(sortCol) : desc(sortCol);

      const rows = await db
        .select()
        .from(qsoLog)
        .where(and(...conditions))
        .orderBy(order)
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  /** Supprimer un QSO par id */
  /** Compter les QSO du visiteur (pour la pagination) */
  count: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        band: z.string().optional(),
        mode: z.string().optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const conditions = [eq(qsoLog.visitorId, input.visitorId)];
      if (input.band) conditions.push(eq(qsoLog.band, input.band));
      if (input.mode) conditions.push(eq(qsoLog.mode, normalizeMode(input.mode)));
      if (input.search) conditions.push(like(qsoLog.dxCall, `%${input.search.toUpperCase()}%`));
      if (input.dateFrom) conditions.push(gte(qsoLog.qsoDateUtc, new Date(input.dateFrom)));
      if (input.dateTo) {
        const to = new Date(input.dateTo);
        to.setHours(23, 59, 59, 999);
        conditions.push(lte(qsoLog.qsoDateUtc, to));
      }
      const result = await db
        .select({ total: count(), dxccCount: countDistinct(qsoLog.dxccCode) })
        .from(qsoLog)
        .where(and(...conditions));
      return { total: result[0]?.total ?? 0, dxccCount: result[0]?.dxccCount ?? 0 };
    }),

  distinctBands: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .selectDistinct({ band: qsoLog.band })
        .from(qsoLog)
        .where(eq(qsoLog.visitorId, input.visitorId));
      const bands = rows
        .map((r) => r.band)
        .filter((b): b is string => !!b)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      return { bands };
    }),

  delete: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db
        .delete(qsoLog)
        .where(
          and(
            eq(qsoLog.id, input.id),
            eq(qsoLog.visitorId, input.visitorId)
          )
        );
      return { ok: true };
    }),

  /** Exporter le logbook en format ADIF */
  exportAdif: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .select()
        .from(qsoLog)
        .where(eq(qsoLog.visitorId, input.visitorId))
        .orderBy(desc(qsoLog.qsoDateUtc));

      const adif = generateAdif(rows);
      return { adif, count: rows.length };
    }),

  /** Importer un fichier ADIF dans le logbook */
  importAdif: publicProcedure
    .input(
      z.object({
        visitorId: z.string().min(1),
        adifContent: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const lines = input.adifContent;
      const eohIdx = lines.toUpperCase().indexOf("<EOH>");
      const body = eohIdx >= 0 ? lines.slice(eohIdx + 5) : lines;

      function parseRecord(record: string): Record<string, string> {
        const result: Record<string, string> = {};
        const re = /<([A-Z_]+):\d+(?::[A-Z])?>([^<]*)/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(record)) !== null) {
          result[m[1].toUpperCase()] = m[2].trim();
        }
        return result;
      }

      const records = body.split(/<EOR>/i).map((r) => r.trim()).filter(Boolean);
      let imported = 0;
      let skipped = 0;
      let duplicates = 0;

      // Charger les QSO existants pour déduplication (call + date arrondie à la minute)
      const existingRows = await db
        .select({ dxCall: qsoLog.dxCall, qsoDateUtc: qsoLog.qsoDateUtc, freqKhz: qsoLog.freqKhz })
        .from(qsoLog)
        .where(eq(qsoLog.visitorId, input.visitorId));
      // Index de déduplication : "CALL|YYYYMMDDTHHMM|FREQ_KHZ_ROUNDED"
      const existingKeys = new Set(
        existingRows.map((r) => {
          const d = r.qsoDateUtc;
          const key = `${r.dxCall}|${d.toISOString().slice(0, 16)}|${Math.round(r.freqKhz)}`;
          return key;
        })
      );

      for (const rec of records) {
        const fields = parseRecord(rec);
        const call = fields["CALL"];
        if (!call) { skipped++; continue; }

        let freqKhz = 0;
        if (fields["FREQ"]) {
          freqKhz = parseFloat(fields["FREQ"]) * 1000;
        } else if (fields["BAND"]) {
          const bandMap: Record<string, number> = {
            "160m": 1850, "80m": 3700, "40m": 7100, "30m": 10125,
            "20m": 14200, "17m": 18100, "15m": 21200, "12m": 24940,
            "10m": 28500, "6m": 51000, "2m": 145000,
          };
          freqKhz = bandMap[fields["BAND"].toLowerCase()] || 14200;
        }
        if (freqKhz <= 0) { skipped++; continue; }

        const band = fields["BAND"] || "20m";
        const mode = normalizeMode(fields["MODE"] || "SSB");
        const dateStr = fields["QSO_DATE"] || "";
        const timeStr = fields["TIME_ON"] || "0000";
        let qsoDate = new Date();
        if (dateStr.length === 8) {
          const y = dateStr.slice(0, 4);
          const mo = dateStr.slice(4, 6);
          const d = dateStr.slice(6, 8);
          const h = timeStr.slice(0, 2).padStart(2, "0");
          const min = timeStr.slice(2, 4).padStart(2, "0");
          qsoDate = new Date(`${y}-${mo}-${d}T${h}:${min}:00Z`);
        }

        // Vérification doublon
        const dedupKey = `${call.toUpperCase()}|${qsoDate.toISOString().slice(0, 16)}|${Math.round(freqKhz)}`;
        if (existingKeys.has(dedupKey)) { duplicates++; continue; }
        existingKeys.add(dedupKey); // éviter les doublons dans le même fichier

        const rstSent = fields["RST_SENT"] || defaultRst(mode);
        const rstRcvd = fields["RST_RCVD"] || defaultRst(mode);
        const country = fields["COUNTRY"] || fields["DXCC"] || null;
        const notes = fields["COMMENT"] || fields["NOTES"] || null;

        let dxccCode: string | null = null;
        let dxCountry: string | null = country;
        const entity = findDxccByCallsign(call.toUpperCase());
        if (entity) {
          dxccCode = entity.code;
          dxCountry = dxCountry || entity.name;
        }

        try {
          await db.insert(qsoLog).values({
            visitorId: input.visitorId,
            dxCall: call.toUpperCase(),
            freqKhz,
            band: band.toLowerCase().endsWith("m") ? band.toLowerCase() : band,
            mode,
            dxCountry,
            dxccCode,
            rstSent,
            rstRcvd,
            notes,
            qsoDateUtc: qsoDate,
          });
          if (dxccCode) {
            try {
              await db.insert(dxccWorked).values({
                visitorId: input.visitorId,
                dxccCode,
                band: band.toLowerCase().endsWith("m") ? band.toLowerCase() : band,
                mode,
                dxCall: call.toUpperCase(),
                workedAt: qsoDate,
              });
            } catch (_) { /* duplicate — ignorer */ }
          }
          imported++;
        } catch (_e) {
          skipped++;
        }
      }

      return { imported, skipped, duplicates, total: records.length };
    }),

  /** Statistiques du logbook pour les graphiques */
  stats: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .select()
        .from(qsoLog)
        .where(eq(qsoLog.visitorId, input.visitorId))
        .orderBy(desc(qsoLog.qsoDateUtc));

      const byBand: Record<string, number> = {};
      const byMode: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      const dxccSet = new Set<string>();

      for (const r of rows) {
        byBand[r.band] = (byBand[r.band] || 0) + 1;
        byMode[r.mode] = (byMode[r.mode] || 0) + 1;
        const day = r.qsoDateUtc.toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
        if (r.dxccCode) dxccSet.add(r.dxccCode);
      }

      // Progression DXCC cumulée par mois
      const dxccByMonth: Record<string, Set<string>> = {};
      for (const r of [...rows].reverse()) {
        if (!r.dxccCode) continue;
        const month = r.qsoDateUtc.toISOString().slice(0, 7);
        if (!dxccByMonth[month]) dxccByMonth[month] = new Set();
        dxccByMonth[month].add(r.dxccCode);
      }
      const dxccCumul: { month: string; count: number }[] = [];
      const seen = new Set<string>();
      for (const [month, codes] of Object.entries(dxccByMonth).sort()) {
        for (const c of codes) seen.add(c);
        dxccCumul.push({ month, count: seen.size });
      }

      // Derniers 30 jours
      const today = new Date();
      const daily: { day: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        daily.push({ day: key, count: byDay[key] || 0 });
      }

      return {
        total: rows.length,
        dxccCount: dxccSet.size,
        byBand: Object.entries(byBand).sort((a, b) => b[1] - a[1]),
        byMode: Object.entries(byMode).sort((a, b) => b[1] - a[1]),
        daily,
        dxccCumul,
      };
    }),

  /**
   * Recalcule les codes DXCC manquants (NULL) dans le logbook.
   * Utile après un import ADIF ou après une mise à jour de la table DXCC.
   */
  rebuildDxcc: publicProcedure
    .input(z.object({ visitorId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      // Récupérer tous les QSO sans dxccCode
      const rows = await db
        .select({ id: qsoLog.id, dxCall: qsoLog.dxCall, dxCountry: qsoLog.dxCountry, band: qsoLog.band, mode: qsoLog.mode, qsoDateUtc: qsoLog.qsoDateUtc })
        .from(qsoLog)
        .where(and(eq(qsoLog.visitorId, input.visitorId), sql`(${qsoLog.dxccCode} IS NULL OR ${qsoLog.dxccCode} = '')`));

      let fixed = 0;
      for (const row of rows) {
        // Résoudre par indicatif d'abord, puis par nom de pays
        let entity = findDxccByCallsign(row.dxCall);
        if (!entity && row.dxCountry) entity = findDxccByCountryName(row.dxCountry);
        if (!entity) continue;

        const dxccCode = entity.code;
        const dxCountry = row.dxCountry || entity.name;

        // Mettre à jour le QSO
        await db.update(qsoLog)
          .set({ dxccCode, dxCountry })
          .where(eq(qsoLog.id, row.id));

        // Upsert dans dxcc_worked
        try {
          await db.insert(dxccWorked).values({
            visitorId: input.visitorId,
            dxccCode,
            band: row.band,
            mode: row.mode,
            dxCall: row.dxCall,
            workedAt: row.qsoDateUtc,
          });
        } catch (_) { /* duplicate — ignorer */ }

        fixed++;
      }
      return { fixed, total: rows.length };
    }),

  /** Historique des contacts avec un indicatif donné (déjà travaillé ?) */
  history: publicProcedure
    .input(z.object({
      visitorId: z.string().min(1),
      dxCall: z.string().min(2),
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const call = input.dxCall.toUpperCase().trim();
      const rows = await db
        .select({
          band: qsoLog.band,
          mode: qsoLog.mode,
          freqKhz: qsoLog.freqKhz,
          qsoDateUtc: qsoLog.qsoDateUtc,
          dxCountry: qsoLog.dxCountry,
          rstSent: qsoLog.rstSent,
          rstRcvd: qsoLog.rstRcvd,
        })
        .from(qsoLog)
        .where(and(
          eq(qsoLog.visitorId, input.visitorId),
          eq(qsoLog.dxCall, call)
        ))
        .orderBy(desc(qsoLog.qsoDateUtc))
        .limit(20);

      // Résumé par bande/mode
      const bandModes: Record<string, Set<string>> = {};
      for (const r of rows) {
        if (!bandModes[r.band]) bandModes[r.band] = new Set();
        bandModes[r.band].add(r.mode);
      }
      const summary = Object.entries(bandModes).map(([band, modes]) => ({
        band,
        modes: [...modes],
      }));

      return {
        count: rows.length,
        contacts: rows.map(r => ({
          band: r.band,
          mode: r.mode,
          freqKhz: r.freqKhz,
          date: r.qsoDateUtc.toISOString(),
          country: r.dxCountry,
          rstSent: r.rstSent,
          rstRcvd: r.rstRcvd,
        })),
        summary,
      };
    }),
});
