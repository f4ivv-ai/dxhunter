/**
 * Endpoint REST dédié pour l'import de fichiers ADIF.
 * Utilise multipart/form-data (multer) au lieu de JSON tRPC
 * pour éviter les timeouts sur les gros fichiers en production.
 */
import { Router } from "express";
import multer from "multer";
import { getDb } from "./db";
import { qsoLog, dxccWorked } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { findDxccByCallsign } from "../shared/dxccEntities";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

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

function defaultRst(mode: string): string {
  const m = mode.toUpperCase();
  if (m === "CW" || m === "RTTY" || m === "FT8" || m === "FT4") return "599";
  return "59";
}

function parseRecord(record: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /<([A-Z_]+):\d+(?::[A-Z])?>([^<]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(record)) !== null) {
    result[m[1].toUpperCase()] = m[2].trim();
  }
  return result;
}

const BAND_FREQ_MAP: Record<string, number> = {
  "160m": 1850, "80m": 3700, "40m": 7100, "30m": 10125,
  "20m": 14200, "17m": 18100, "15m": 21200, "12m": 24940,
  "10m": 28500, "6m": 51000, "2m": 145000,
};

export function registerImportAdifRoute(app: import("express").Express) {
  const router = Router();

  router.post(
    "/api/import-adif",
    upload.single("adifFile"),
    async (req, res) => {
      try {
        const visitorId = (req.body?.visitorId as string) || "";
        if (!visitorId) {
          res.status(400).json({ ok: false, error: "visitorId manquant" });
          return;
        }

        let adifContent = "";
        if (req.file) {
          // Upload multipart
          adifContent = req.file.buffer.toString("utf-8");
        } else if (req.body?.adifContent) {
          // Fallback : contenu texte direct
          adifContent = req.body.adifContent as string;
        } else {
          res.status(400).json({ ok: false, error: "Fichier ADIF manquant" });
          return;
        }

        const db = (await getDb())!;

        // Parser le contenu ADIF
        const eohIdx = adifContent.toUpperCase().indexOf("<EOH>");
        const body = eohIdx >= 0 ? adifContent.slice(eohIdx + 5) : adifContent;
        const records = body.split(/<EOR>/i).map((r) => r.trim()).filter(Boolean);

        // Charger les QSO existants pour déduplication
        const existingRows = await db
          .select({ dxCall: qsoLog.dxCall, qsoDateUtc: qsoLog.qsoDateUtc, freqKhz: qsoLog.freqKhz })
          .from(qsoLog)
          .where(eq(qsoLog.visitorId, visitorId));

        const existingKeys = new Set(
          existingRows.map((r) => {
            const d = r.qsoDateUtc;
            return `${r.dxCall}|${d.toISOString().slice(0, 16)}|${Math.round(r.freqKhz)}`;
          })
        );

        let imported = 0;
        let skipped = 0;
        let duplicates = 0;

        for (const rec of records) {
          const fields = parseRecord(rec);
          const call = fields["CALL"];
          if (!call) { skipped++; continue; }

          let freqKhz = 0;
          if (fields["FREQ"]) {
            freqKhz = parseFloat(fields["FREQ"]) * 1000;
          } else if (fields["BAND"]) {
            freqKhz = BAND_FREQ_MAP[fields["BAND"].toLowerCase()] || 14200;
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

          // Déduplication
          const dedupKey = `${call.toUpperCase()}|${qsoDate.toISOString().slice(0, 16)}|${Math.round(freqKhz)}`;
          if (existingKeys.has(dedupKey)) { duplicates++; continue; }
          existingKeys.add(dedupKey);

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
              visitorId,
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
                  visitorId,
                  dxccCode,
                  band: band.toLowerCase().endsWith("m") ? band.toLowerCase() : band,
                  mode,
                  dxCall: call.toUpperCase(),
                  workedAt: qsoDate,
                }).onDuplicateKeyUpdate({ set: { dxCall: call.toUpperCase() } });
              } catch {
                // ignore DXCC duplicate
              }
            }
            imported++;
          } catch {
            skipped++;
          }
        }

        res.json({ ok: true, imported, duplicates, skipped });
      } catch (err) {
        console.error("[import-adif]", err);
        res.status(500).json({ ok: false, error: String(err) });
      }
    }
  );

  app.use(router);
}
