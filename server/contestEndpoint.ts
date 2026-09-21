/**
 * HTTP endpoint for receiving contest QSOs from the telnet-relay UDP bridge.
 * POST /api/contest/qso
 */
import type { Request, Response } from "express";
import { getDb } from "./db";
import { verifyToken } from "./_core/bridgeToken";
import { contestSessions, contestQsos } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  CONTESTS,
  extractWpxPrefix,
  extractCountryPrefix,
  guessCqZone,
  extractIotaRef,
} from "./contestRules";

export async function contestQsoHandler(req: Request, res: Response) {
  try {
    // Auth check
    const auth = req.headers.authorization;
    const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!verifyToken(provided, "CONTEST_TOKEN")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { action, qso, call, band, timestamp } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing action" });
    }

    const db = (await getDb())!;

    // Get active session
    const [session] = await db
      .select()
      .from(contestSessions)
      .where(eq(contestSessions.active, 1))
      .limit(1);

    if (!session) {
      return res.status(200).json({ ok: true, warning: "No active contest session" });
    }

    const contest = CONTESTS[session.contestId];

    if (action === "add" && qso) {
      // Compute multipliers
      const countryPrefix = qso.countryPrefix || extractCountryPrefix(qso.call);
      const wpxPrefix = qso.wpxPrefix || extractWpxPrefix(qso.call);
      const cqZone = qso.zone ? parseInt(qso.zone) : guessCqZone(countryPrefix);

      let multiType: string | null = null;
      let multiValue: string | null = null;
      let isNewMulti = 0;

      if (contest) {
        const exchange = qso.exchange1 || qso.rcvnr || "";
        const spotInfo = {
          call: qso.call,
          band: qso.band,
          mode: qso.mode || "SSB",
          countryPrefix,
          cqZone,
          wpxPrefix,
          continent: qso.continent,
          exchange,
          department: qso.exchange1, // For REF
          state: qso.exchange1, // For ARRL DX
          iotaRef: extractIotaRef(exchange) || undefined, // For IOTA
          comment: qso.comment || "",
        };

        const candidates = contest.extractMultipliers(spotInfo);

        // Check which multipliers are new
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
            break; // First new mult found
          }
        }
      }

      // Parse QSO time
      let qsoTime = Date.now();
      if (qso.timestamp) {
        const parsed = new Date(qso.timestamp).getTime();
        if (!isNaN(parsed)) qsoTime = parsed;
      }

      // Insert QSO
      await db.insert(contestQsos).values({
        sessionId: session.id,
        call: qso.call.toUpperCase(),
        band: qso.band,
        mode: qso.mode || "SSB",
        freqKhz: qso.freqKhz || null,
        qsoTime,
        rstSent: qso.snt || "59",
        rstRcvd: qso.rcv || "59",
        exchangeSent: qso.sntnr || null,
        exchangeRcvd: qso.rcvnr || qso.exchange1 || null,
        cqZone: cqZone || null,
        countryPrefix: countryPrefix || null,
        wpxPrefix: wpxPrefix || null,
        continent: qso.continent || null,
        isNewMulti,
        multiType,
        multiValue,
        stationName: qso.stationName || null,
        isRunQso: qso.isRunQSO ? 1 : 0,
        externalId: qso.id || null,
      });

      console.log(
        `[Contest] QSO: ${qso.call} ${qso.band}m ${qso.mode}${isNewMulti ? ` ★ MULTI ${multiType}=${multiValue}` : ""}`,
      );

      return res.json({ ok: true, isNewMulti, multiType, multiValue });
    }

    if (action === "delete") {
      // Soft-delete by call + band (or external ID)
      if (call) {
        await db
          .update(contestQsos)
          .set({ deleted: 1 })
          .where(
            and(
              eq(contestQsos.sessionId, session.id),
              eq(contestQsos.call, call.toUpperCase()),
              eq(contestQsos.deleted, 0),
            ),
          );
        console.log(`[Contest] DEL: ${call}`);
      }
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action: " + action });
  } catch (err: any) {
    console.error("[Contest] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
