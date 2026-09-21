import {
  double,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Subscription level: free = cluster only, premium = full access */
  subscription: mysqlEnum("subscription", ["free", "premium"]).default("free").notNull(),
  /** Premium expiry date (null = never expires once set by admin) */
  subscriptionExpiry: timestamp("subscriptionExpiry"),
  /** Date de début de la période d'essai (10 jours). Initialisée à la première connexion. */
  trialStartDate: timestamp("trialStartDate"),
  /** QTH Locator (Maidenhead, ex: JN18du) pour calculs distance/azimut */
  locator: varchar("locator", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Journal de calibration TM0HQ.
 * Un instantané = pour une date (UTC) + une heure UTC + une zone ITU, on compare
 * le score d'ouverture 40 m PRÉDIT par le moteur à l'activité RÉELLE observée
 * (nombre de spots 40 m vers cette zone). Permet l'entraînement J-12 → J-0 :
 * mesurer l'écart, suivre la fiabilité du modèle et l'affiner jour après jour.
 *
 * Une ligne est unique par (snapDate, hourUtc, zoneId) : on écrase (upsert) si on
 * recapture le même créneau, ce qui garantit l'idempotence des Heartbeat.
 */
export const calibrationSnapshots = mysqlTable(
  "calibration_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Date UTC du créneau, format ISO "YYYY-MM-DD". */
    snapDate: varchar("snapDate", { length: 10 }).notNull(),
    /** Heure UTC (0-23) du créneau observé. */
    hourUtc: int("hourUtc").notNull(),
    /** Bande contest (160m, 80m, 40m, 20m, 15m, 10m). */
    band: varchar("band", { length: 8 }).notNull().default("40m"),
    /** Identifiant de zone ITU (ex. "itu27") ou axe ("NA", "AS"…). */
    zoneId: varchar("zoneId", { length: 24 }).notNull(),
    /** Libellé lisible de la zone (ex. "Amérique du Nord"). */
    zoneLabel: varchar("zoneLabel", { length: 64 }),
    /** Score d'ouverture prédit par le moteur 0-100. */
    predictedScore: int("predictedScore").notNull(),
    /** Nombre de spots 40 m réels observés vers cette zone sur le créneau. */
    actualSpots: int("actualSpots").notNull().default(0),
    /** Score réel normalisé 0-100 dérivé du nombre de spots. */
    actualScore: int("actualScore").notNull().default(0),
    /** Écart signé (predicted - actual), en points. */
    error: int("error").notNull().default(0),
    /** Kp planinétaire au moment de la capture. */
    kp: double("kp"),
    /** SFI (F10.7) au moment de la capture. */
    sfi: int("sfi"),
    /** Indice A planinétaire au moment de la capture. */
    aIndex: int("aIndex"),
    /** Note libre (manuelle ou automatique). */
    note: text("note"),
    /** Origine : "auto" (Heartbeat) ou "manual" (bouton). */
    source: mysqlEnum("source", ["auto", "manual"]).default("auto").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    slotUniq: uniqueIndex("slot_uniq").on(t.snapDate, t.hourUtc, t.band, t.zoneId),
  }),
);

export type CalibrationSnapshot = typeof calibrationSnapshots.$inferSelect;
export type InsertCalibrationSnapshot = typeof calibrationSnapshots.$inferInsert;

/**
 * WebSDR Favoris — SDR marqués comme favoris par un visiteur.
 * visitorId = openId si connecté, sinon un UUID localStorage.
 */
export const websdrFavorites = mysqlTable(
  "websdr_favorites",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull(),
    sdrName: varchar("sdrName", { length: 255 }).notNull(),
    sdrUrl: varchar("sdrUrl", { length: 512 }).notNull(),
    lat: double("lat"),
    lon: double("lon"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    visitorSdrUniq: uniqueIndex("visitor_sdr_uniq").on(t.visitorId, t.sdrName),
  }),
);

export type WebsdrFavorite = typeof websdrFavorites.$inferSelect;
export type InsertWebsdrFavorite = typeof websdrFavorites.$inferInsert;

/**
 * WebSDR Supprimés — SDR que le visiteur ne veut plus voir.
 * Ils ne réapparaîtront jamais dans les suggestions.
 */
export const websdrDeleted = mysqlTable(
  "websdr_deleted",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull(),
    sdrName: varchar("sdrName", { length: 255 }).notNull(),
    sdrUrl: varchar("sdrUrl", { length: 512 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    visitorDelUniq: uniqueIndex("visitor_del_uniq").on(t.visitorId, t.sdrName),
  }),
);

export type WebsdrDeleted = typeof websdrDeleted.$inferSelect;
export type InsertWebsdrDeleted = typeof websdrDeleted.$inferInsert;

/**
 * Indicatifs déjà contactés pendant un contest.
 * Permet de filtrer le flux DX pour ne plus afficher les stations déjà travaillées.
 * contestId = identifiant du contest (ex: "IARU-HF-2026") pour séparer les contests.
 */
export const workedCalls = mysqlTable(
  "worked_calls",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull(),
    dxCall: varchar("dxCall", { length: 32 }).notNull(),
    band: varchar("band", { length: 8 }),
    contestId: varchar("contestId", { length: 64 }).notNull().default("IARU-HF-2026"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    visitorCallBandUniq: uniqueIndex("visitor_call_band_uniq").on(t.visitorId, t.dxCall, t.band, t.contestId),
  }),
);

export type WorkedCall = typeof workedCalls.$inferSelect;
export type InsertWorkedCall = typeof workedCalls.$inferInsert;


/**
 * Spots "Hors Bande" (HB) — fréquences non accessibles pour l'opérateur.
 * Contrairement à worked_calls qui masque l'indicatif entièrement,
 * HB ne masque que le spot à cette fréquence précise.
 * Si le même indicatif réapparaît sur une fréquence autorisée, il reste visible.
 */
export const oobSpots = mysqlTable(
  "oob_spots",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull(),
    dxCall: varchar("dxCall", { length: 32 }).notNull(),
    freqKhz: int("freqKhz").notNull(),
    contestId: varchar("contestId", { length: 64 }).notNull().default("IARU-HF-2026"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    visitorCallFreqUniq: uniqueIndex("visitor_call_freq_uniq").on(t.visitorId, t.dxCall, t.freqKhz, t.contestId),
  }),
);

export type OobSpot = typeof oobSpots.$inferSelect;
export type InsertOobSpot = typeof oobSpots.$inferInsert;

/**
 * DXCC travaillés — entités DXCC contactées par l'utilisateur.
 * Suivi par bande et par mode pour un DXCC complet multi-bandes.
 * visitorId = openId si connecté, sinon UUID localStorage.
 */
export const dxccWorked = mysqlTable(
  "dxcc_worked",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull(),
    /** Code entité DXCC (ex: "F", "JA", "W") */
    dxccCode: varchar("dxccCode", { length: 16 }).notNull(),
    /** Bande (ex: "20m", "40m") */
    band: varchar("band", { length: 8 }).notNull(),
    /** Mode (ex: "SSB", "CW", "FT8") */
    mode: varchar("mode", { length: 16 }).notNull().default("SSB"),
    /** Indicatif travaillé */
    dxCall: varchar("dxCall", { length: 32 }),
    workedAt: timestamp("workedAt").defaultNow().notNull(),
  },
  (t) => ({
    visitorDxccBandModeUniq: uniqueIndex("visitor_dxcc_band_mode_uniq").on(
      t.visitorId, t.dxccCode, t.band, t.mode
    ),
  }),
);
export type DxccWorked = typeof dxccWorked.$inferSelect;
export type InsertDxccWorked = typeof dxccWorked.$inferInsert;

/**
 * Journal de trafic (Logbook) — QSO enregistrés par l'utilisateur.
 * Compatible export ADIF pour QRZ.com / LoTW.
 * Chaque QSO met automatiquement à jour le suivi DXCC.
 */
export const qsoLog = mysqlTable(
  "qso_log",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull(),
    /** Indicatif de la station DX travaillée */
    dxCall: varchar("dxCall", { length: 32 }).notNull(),
    /** Fréquence en kHz */
    freqKhz: double("freqKhz").notNull(),
    /** Bande (ex: "20m", "40m") */
    band: varchar("band", { length: 8 }).notNull(),
    /** Mode (ex: "SSB", "CW", "FT8") */
    mode: varchar("mode", { length: 16 }).notNull().default("SSB"),
    /** Pays / entité DX */
    dxCountry: varchar("dxCountry", { length: 128 }),
    /** Code entité DXCC (préfixe, ex: "JA", "W", "F") */
    dxccCode: varchar("dxccCode", { length: 16 }),
    /** RST envoyé (ex: "59", "599") */
    rstSent: varchar("rstSent", { length: 8 }).default("59"),
    /** RST reçu */
    rstRcvd: varchar("rstRcvd", { length: 8 }).default("59"),
    /** Nom de l'opérateur DX (si connu) */
    operatorName: varchar("operatorName", { length: 64 }),
    /** Notes libres */
    notes: text("notes"),
    /** Date/heure UTC du QSO (timestamp Unix ms) */
    qsoDateUtc: timestamp("qsoDateUtc").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
);
export type QsoLog = typeof qsoLog.$inferSelect;
export type InsertQsoLog = typeof qsoLog.$inferInsert;

/**
 * Paramètres personnalisés par visiteur.
 * Stocke les préférences comme l'objectif DXCC.
 */
export const userSettings = mysqlTable(
  "user_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    visitorId: varchar("visitorId", { length: 128 }).notNull().unique(),
    /** Objectif DXCC personnalisé (ex: 100, 200, 340) */
    dxccGoal: int("dxccGoal").default(100),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Snapshots de propagation FT8 par quart d'heure (SNR >= -8 dB).
 * Enregistre toutes les 15 minutes l'activité FT8 par bande × continent
 * pour calibrer le modèle de propagation et prédire les ouvertures.
 * Seuil -8 dB = signal exploitable en SSB.
 * Unique par (snapDate, hourUtc, minuteUtc, band, continent).
 */
export const propagationFt8Hourly = mysqlTable(
  "propagation_ft8_hourly",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Date UTC du créneau, format ISO "YYYY-MM-DD". */
    snapDate: varchar("snapDate", { length: 10 }).notNull(),
    /** Heure UTC (0-23) du créneau observé. */
    hourUtc: int("hourUtc").notNull(),
    /** Début du quart d'heure UTC (0, 15, 30 ou 45). */
    minuteUtc: int("minuteUtc").notNull().default(0),
    /** Bande contest (160m, 80m, 40m, 20m, 15m, 10m). */
    band: varchar("band", { length: 8 }).notNull(),
    /** Continent émetteur (EU, NA, SA, AF, AS, OC). */
    continent: varchar("continent", { length: 4 }).notNull(),
    /** Nombre de spots FT8 avec SNR >= -8 dB sur ce créneau. */
    spotCount: int("spotCount").notNull().default(0),
    /** SNR moyen des spots. */
    avgSnr: double("avgSnr"),
    /** SNR max observé. */
    maxSnr: double("maxSnr"),
    /** Azimut dominant depuis le QTH de référence (degrés, 0-360). */
    dominantAzimuth: int("dominantAzimuth"),
    /** SFI (F10.7) au moment de la capture. */
    sfi: int("sfi"),
    /** Kp planétaire au moment de la capture. */
    kp: double("kp"),
    /** Source géographique retenue : F4IVV, JN25, ITU27 ou WORLD. */
    receiverSource: varchar("receiverSource", { length: 12 }).notNull().default("WORLD"),
    /** Indicatif du récepteur prioritaire quand disponible. */
    receiverCall: varchar("receiverCall", { length: 16 }),
    /** Origine : "auto" (Heartbeat) ou "manual". */
    source: mysqlEnum("source", ["auto", "manual"]).default("auto").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    slotUniq: uniqueIndex("ft8_quarter_slot_uniq").on(t.snapDate, t.hourUtc, t.minuteUtc, t.band, t.continent),
  }),
);

export type PropagationFt8Hourly = typeof propagationFt8Hourly.$inferSelect;
export type InsertPropagationFt8Hourly = typeof propagationFt8Hourly.$inferInsert;

// ─── Contest Mode ────────────────────────────────────────────────────────────

/**
 * Active contest session — one at a time.
 * Stores which contest is active, category, and time window.
 */
export const contestSessions = mysqlTable("contest_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Contest identifier: CQWW_SSB, CQWPX_SSB, ARRL_DX, REF_SSB */
  contestId: varchar("contestId", { length: 32 }).notNull(),
  /** Category: MULTI_ONE, SINGLE_OP */
  category: varchar("category", { length: 32 }).notNull(),
  /** Power class: HIGH, LOW, QRP */
  power: varchar("power", { length: 16 }).default("HIGH").notNull(),
  /** Operator callsign */
  mycall: varchar("mycall", { length: 16 }).default("F4IVV").notNull(),
  /** Contest start time (UTC timestamp ms) */
  startTime: double("startTime"),
  /** Contest end time (UTC timestamp ms) */
  endTime: double("endTime"),
  /** Is this session currently active? */
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContestSession = typeof contestSessions.$inferSelect;
export type InsertContestSession = typeof contestSessions.$inferInsert;

/**
 * QSOs logged during a contest session (received from SDC/N1MM via UDP).
 * Used to determine "already worked" and "multiplier" status of spots.
 */
export const contestQsos = mysqlTable("contest_qsos", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to contest_sessions.id */
  sessionId: int("sessionId").notNull(),
  /** Worked callsign */
  call: varchar("call", { length: 20 }).notNull(),
  /** Band (20, 40, 15, etc.) */
  band: varchar("band", { length: 8 }).notNull(),
  /** Mode (SSB, CW, RTTY) */
  mode: varchar("mode", { length: 8 }).default("SSB").notNull(),
  /** Frequency in kHz */
  freqKhz: double("freqKhz"),
  /** UTC timestamp of QSO */
  qsoTime: double("qsoTime"),
  /** RST sent */
  rstSent: varchar("rstSent", { length: 8 }),
  /** RST received */
  rstRcvd: varchar("rstRcvd", { length: 8 }),
  /** Exchange sent (zone, serial, dept, etc.) */
  exchangeSent: varchar("exchangeSent", { length: 32 }),
  /** Exchange received */
  exchangeRcvd: varchar("exchangeRcvd", { length: 32 }),
  /** CQ Zone of the DX (for CQWW) */
  cqZone: int("cqZone"),
  /** Country prefix (DL, W, VE, etc.) */
  countryPrefix: varchar("countryPrefix", { length: 8 }),
  /** WPX prefix (for CQWPX) */
  wpxPrefix: varchar("wpxPrefix", { length: 12 }),
  /** Continent */
  continent: varchar("continent", { length: 4 }),
  /** Is this a new multiplier? (computed at insert time) */
  isNewMulti: int("isNewMulti").default(0),
  /** Multiplier type: "zone", "dxcc", "prefix", "dept", "state" */
  multiType: varchar("multiType", { length: 16 }),
  /** Multiplier value (the actual mult: "14", "DL", "W1", "75", etc.) */
  multiValue: varchar("multiValue", { length: 32 }),
  /** Station name (for multi-op) */
  stationName: varchar("stationName", { length: 16 }),
  /** Is this a Run QSO (vs S&P) */
  isRunQso: int("isRunQso").default(0),
  /** External ID from SDC/N1MM */
  externalId: varchar("externalId", { length: 32 }),
  /** Deleted flag (soft delete) */
  deleted: int("deleted").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContestQso = typeof contestQsos.$inferSelect;
export type InsertContestQso = typeof contestQsos.$inferInsert;

/**
 * CAT Commands Queue — stocke les commandes en attente entre le navigateur et le bridge.
 * Nécessaire car en mode Autoscale (serverless), la mémoire n'est pas partagée entre instances.
 * Le bridge récupère les commandes via cat.push et elles sont supprimées après lecture.
 */
export const catCommands = mysqlTable("cat_commands", {
  id: int("id").autoincrement().primaryKey(),
  /** JSON sérialisé de la commande complète */
  payload: text("payload").notNull(),
  /** Timestamp de création (ms epoch) */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CatCommand = typeof catCommands.$inferSelect;
export type InsertCatCommand = typeof catCommands.$inferInsert;

/**
 * CAT Relay State — dernière télémétrie du bridge partagée entre les instances Autoscale.
 * Une seule ligne `primary` est mise à jour par cat.push et lue par cat.state.
 */
export const catRelayStates = mysqlTable("cat_relay_state", {
  stateKey: varchar("stateKey", { length: 32 }).primaryKey(),
  payload: text("payload").notNull(),
  // Fourni explicitement à chaque insert/upsert pour rester compatible TiDB.
  updatedAt: timestamp("updatedAt", { fsp: 3 }).notNull(),
});

export type CatRelayState = typeof catRelayStates.$inferSelect;
export type InsertCatRelayState = typeof catRelayStates.$inferInsert;
