import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  calibrationSnapshots,
  CalibrationSnapshot,
  InsertCalibrationSnapshot,
  InsertUser,
  propagationFt8Hourly,
  InsertPropagationFt8Hourly,
  PropagationFt8Hourly,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/* ------------------------------------------------------------------ */
/* Journal de calibration TM0HQ                                        */
/* ------------------------------------------------------------------ */

/**
 * Enregistre (upsert) un lot de snapshots de calibration. La clé unique
 * (snapDate, hourUtc, zoneId) garantit l'idempotence : recapturer le même
 * créneau écrase la valeur précédente plutôt que de créer un doublon.
 */
export async function saveCalibrationSnapshots(
  rows: InsertCalibrationSnapshot[],
): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save calibration: database not available");
    return 0;
  }
  if (rows.length === 0) return 0;
  for (const row of rows) {
    await db
      .insert(calibrationSnapshots)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          zoneLabel: row.zoneLabel,
          predictedScore: row.predictedScore,
          actualSpots: row.actualSpots,
          actualScore: row.actualScore,
          error: row.error,
          kp: row.kp,
          sfi: row.sfi,
          aIndex: row.aIndex,
          note: row.note,
          source: row.source,
        },
      });
  }
  return rows.length;
}

/** Liste les snapshots des `days` derniers jours (par défaut 14), triés récents d'abord. */
export async function listCalibrationSnapshots(
  days = 14,
): Promise<CalibrationSnapshot[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list calibration: database not available");
    return [];
  }
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  return db
    .select()
    .from(calibrationSnapshots)
    .where(gte(calibrationSnapshots.snapDate, since))
    .orderBy(
      desc(calibrationSnapshots.snapDate),
      desc(calibrationSnapshots.hourUtc),
    );
}

/** Snapshots d'une date précise (UTC "YYYY-MM-DD"). */
export async function calibrationByDate(
  date: string,
): Promise<CalibrationSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calibrationSnapshots)
    .where(eq(calibrationSnapshots.snapDate, date))
    .orderBy(calibrationSnapshots.hourUtc);
}

/* ------------------------------------------------------------------ */
/* Admin — Gestion des utilisateurs                                     */
/* ------------------------------------------------------------------ */

/** Liste tous les utilisateurs (admin). */
export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

/** Active/désactive le premium pour un utilisateur. */
export async function setUserSubscription(
  userId: number,
  subscription: "free" | "premium",
  expiryDate?: Date | null,
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ subscription, subscriptionExpiry: expiryDate ?? null })
    .where(eq(users.id, userId));
}

/** Met à jour le locator d'un utilisateur. */
export async function updateUserLocator(openId: string, locator: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ locator }).where(eq(users.openId, openId));
}

/** Vérifie si un créneau exact existe déjà (idempotence Heartbeat). */
export async function hasCalibrationSlot(
  snapDate: string,
  hourUtc: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const r = await db
    .select({ id: calibrationSnapshots.id })
    .from(calibrationSnapshots)
    .where(
      and(
        eq(calibrationSnapshots.snapDate, snapDate),
        eq(calibrationSnapshots.hourUtc, hourUtc),
      ),
    )
    .limit(1);
  return r.length > 0;
}

/** Initialise la période d'essai si pas encore commencée. */
export async function initTrialIfNeeded(openId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (user && !user.trialStartDate) {
    await db.update(users).set({ trialStartDate: new Date() }).where(eq(users.openId, openId));
  }
}


// ─── FT8 Hourly Propagation Snapshots ────────────────────────────────────────

/** Sauvegarde (upsert) un lot de snapshots FT8 par quart d'heure. */
export async function saveFt8HourlySnapshots(
  rows: InsertPropagationFt8Hourly[],
): Promise<{ saved: number }> {
  const db = await getDb();
  if (!db || rows.length === 0) return { saved: 0 };

  let saved = 0;
  for (const row of rows) {
    await db
      .insert(propagationFt8Hourly)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          spotCount: row.spotCount,
          avgSnr: row.avgSnr,
          maxSnr: row.maxSnr,
          dominantAzimuth: row.dominantAzimuth,
          sfi: row.sfi,
          kp: row.kp,
          receiverSource: row.receiverSource,
          receiverCall: row.receiverCall,
          source: row.source,
        },
      });
    saved++;
  }
  return { saved };
}

/** Récupère l'historique FT8 horaire pour une plage de dates. */
export async function listFt8HourlySnapshots(opts: {
  fromDate?: string;
  toDate?: string;
  band?: string;
  continent?: string;
  limit?: number;
}): Promise<PropagationFt8Hourly[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (opts.fromDate) conditions.push(gte(propagationFt8Hourly.snapDate, opts.fromDate));
  if (opts.toDate) conditions.push(lte(propagationFt8Hourly.snapDate, opts.toDate));
  if (opts.band) conditions.push(eq(propagationFt8Hourly.band, opts.band));
  if (opts.continent) conditions.push(eq(propagationFt8Hourly.continent, opts.continent));

  const q = db
    .select()
    .from(propagationFt8Hourly)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(propagationFt8Hourly.snapDate), desc(propagationFt8Hourly.hourUtc), desc(propagationFt8Hourly.minuteUtc))
    .limit(opts.limit ?? 500);

  return q;
}

/**
 * Récupère l'historique pour une heure UTC spécifique (pour prédictions).
 * Retourne les snapshots des 30 derniers jours à la même heure.
 */
export async function getFt8HistoryForHour(
  hourUtc: number,
  band?: string,
): Promise<PropagationFt8Hourly[]> {
  const db = await getDb();
  if (!db) return [];

  // 30 jours en arrière
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const conditions = [
    eq(propagationFt8Hourly.hourUtc, hourUtc),
    gte(propagationFt8Hourly.snapDate, fromDate),
  ];
  if (band) conditions.push(eq(propagationFt8Hourly.band, band));

  return db
    .select()
    .from(propagationFt8Hourly)
    .where(and(...conditions))
    .orderBy(desc(propagationFt8Hourly.snapDate), desc(propagationFt8Hourly.minuteUtc));
}
