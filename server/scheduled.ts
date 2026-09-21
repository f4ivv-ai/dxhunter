/**
 * Handlers des tâches planifiées (Heartbeat).
 * Montés dans server/_core/index.ts AVANT le fallthrough Vite/static.
 *
 * `/api/scheduled/calibration` : capture quotidienne automatique d'un snapshot
 * 40 m (spots réels vs prédiction). Idempotent (upsert par créneau).
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { captureCalibration } from "./calibrationCapture";
import { captureFt8Hourly } from "./ft8HourlyCapture";
import { waitForFreshPskSample } from "./pskreporter";

export async function calibrationScheduledHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }
    const r = await captureCalibration("auto");
    return res.json({ ok: true, saved: r.saved, spotCount: r.spotCount, at: r.at });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("unknown");
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Handler Heartbeat : capture FT8 (SNR >= -8 dB) par bande et continent.
 * Cron : toutes les 15 minutes pour meilleure granularite.
 * Endpoint : /api/scheduled/ft8-hourly
 */
export async function ft8HourlyScheduledHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }
    // Une instance Autoscale peut démarrer à froid juste avant la capture.
    // On observe au plus un cycle FT8, puis le moteur choisit F4IVV/JN25/ITU27/monde.
    await waitForFreshPskSample();
    const r = await captureFt8Hourly("auto");
    return res.json({
      ok: true,
      saved: r.saved,
      totalSpots: r.totalSpots,
      at: r.at,
      bands: r.bands,
      receiverSource: r.receiverSource,
      primaryReceiverSpots: r.primaryReceiverSpots,
      regionalSpots: r.regionalSpots,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("unknown");
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
