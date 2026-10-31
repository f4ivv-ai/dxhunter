/**
 * Captures planifiées intégrées au serveur (remplace le Heartbeat Manus).
 *
 * Sur un serveur permanent (VPS), le processus Node tourne en continu :
 * les captures sont déclenchées par des minuteries alignées sur l'heure UTC.
 *
 *   - Calibration 40 m : tous les jours à 12:00 UTC
 *   - Capture FT8 (SNR ≥ -8 dB) : toutes les 15 minutes (:00, :15, :30, :45)
 *
 * Désactivable avec SCHEDULER_ENABLED=false (par ex. sur une 2e instance).
 */
import { captureCalibration } from "./calibrationCapture";
import { captureFt8Hourly } from "./ft8HourlyCapture";
import { waitForFreshPskSample } from "./pskreporter";

const MINUTE = 60_000;
const QUARTER = 15 * MINUTE;
const DAY = 24 * 60 * MINUTE;
const CALIBRATION_HOUR_UTC = 12;

/** Délai jusqu'au prochain multiple de `periodMs` (+ décalage), en UTC. */
export function msUntilNext(periodMs: number, offsetMs = 0, now = Date.now()): number {
  const elapsed = (now - offsetMs) % periodMs;
  const wait = periodMs - (elapsed < 0 ? elapsed + periodMs : elapsed);
  return wait === 0 ? periodMs : wait;
}

function every(name: string, periodMs: number, offsetMs: number, job: () => Promise<unknown>) {
  let running = false;
  const tick = async () => {
    schedule();
    if (running) {
      console.warn(`[Scheduler] ${name} : exécution précédente encore en cours, tour sauté`);
      return;
    }
    running = true;
    const started = Date.now();
    try {
      await job();
      console.log(`[Scheduler] ${name} OK (${Date.now() - started} ms)`);
    } catch (e) {
      console.error(`[Scheduler] ${name} en échec :`, e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  const schedule = () => {
    const t = setTimeout(tick, msUntilNext(periodMs, offsetMs));
    t.unref?.();
  };
  schedule();
}

export function startScheduler(): void {
  every("Capture FT8", QUARTER, 0, async () => {
    await waitForFreshPskSample();
    return captureFt8Hourly("auto");
  });
  every("Calibration 40 m", DAY, CALIBRATION_HOUR_UTC * 60 * MINUTE, () =>
    captureCalibration("auto"),
  );
  console.log("[Scheduler] Captures planifiées actives (FT8 /15 min, calibration 12:00 UTC)");
}
