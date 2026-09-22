/**
 * CAT Relay Router — HTTP-based relay for CAT bridge ↔ browser communication.
 *
 * Architecture (compatible Autoscale serverless) :
 * 1. Le bridge local (Mac/PC) fait des POST vers `cat.push` avec l'état radio
 *    (fréquence, mode, connected). Authentifié par token.
 * 2. Le navigateur fait des GET polling via `cat.state` pour récupérer l'état.
 * 3. Le navigateur envoie des commandes (QSY) via `cat.command`, le bridge les
 *    récupère via `cat.pendingCommands`.
 *
 * Supporte deux modes :
 * - Single radio (bridge classique v7.x)
 * - SO2R dual radio (bridge-so2r.mjs) avec rôles RUN/MULTI et interlock TX
 *
 * Stockage : en mémoire (volatile). Si le pod redémarre, l'état est perdu
 * (le bridge le renvoie dans les 800ms suivantes de toute façon).
 */

import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifyToken } from "../_core/bridgeToken";
import { getDb } from "../db";
import { catCommands, catRelayStates } from "../../drizzle/schema";
import { lt, gt, lte, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ─── Configuration ──────────────────────────────────────────────────────────

// State is stale after 15 seconds (bridge pushes every 800ms, but SmartLink adds latency)
const STALE_MS = 15000;

// ─── In-memory state ────────────────────────────────────────────────────────

interface RadioState {
  connected: boolean;
  freq: number;
  mode: string;
  name: string;
  tx: boolean;
  rfPower: number;
  nbEnabled: boolean;
  nrEnabled: boolean;
  anfEnabled: boolean;
  apfEnabled: boolean;
  filterLo: number;
  filterHi: number;
  rfGain: number;
  rxAnt: string;
  txAnt: string;
  // Telemetry
  smeter: number;
  fwdPower: number;
  swr: number;
  alc: number;
  paTemp: number;
}

interface So2rState {
  enabled: boolean;
  roles: { run: string; multi: string };
  radioA: RadioState;
  radioB: RadioState;
  updatedAt: number;
}

interface CatState {
  connected: boolean;
  freq: number;
  mode: string;
  radio?: string;
  version?: string;
  /** Identité de station confirmée par le bridge local. */
  station: string;
  /** Modèle réel annoncé par le bridge, par ex. FLEX-6600M. */
  model: string;
  /** monitor = télémétrie uniquement ; operate = commandes non-TX autorisées par le bridge. */
  operationMode: "monitor" | "operate";
  /** Les commandes MOX/TUNE ne sont admises par le bridge que si cette valeur est vraie. */
  txControlAllowed: boolean;
  // Flex control state
  rfPower: number;
  tuneActive: boolean;
  moxActive: boolean;
  nbEnabled: boolean;
  nrEnabled: boolean;
  anfEnabled: boolean;
  apfEnabled: boolean;
  rxAnt: string;
  txAnt: string;
  // RX Filter & DSP
  filterLo: number;
  filterHi: number;
  rfGain: number;
  rxPreset: string;
  // EQ RX (8 bands)
  eqEnabled: boolean;
  eqBands: number[];
  // Telemetry
  smeter: number;
  fwdPower: number;
  swr: number;
  alc: number;
  paTemp: number;
  updatedAt: number;
}

export interface CatCommand {
  id: string;
  action: string;
  freq?: number;
  txFreq?: number;
  rxFreq?: number;
  mode?: string;
  slice?: number;
  value?: number;
  enabled?: boolean;
  param?: string;
  type?: string;
  ant?: string;
  filterLo?: number;
  filterHi?: number;
  rfGain?: number;
  preset?: string;
  eqBands?: number[];
  callsign?: string;
  color?: string;
  target?: string;
  createdAt: number;
}

export function createCatCommandId(
  now = Date.now(),
  uuid = randomUUID()
): string {
  return `cmd-${now}-${uuid.slice(0, 8)}`;
}

export function mergeUniqueCatCommands(
  ...queues: CatCommand[][]
): CatCommand[] {
  const merged = new Map<string, CatCommand>();
  for (const queue of queues) {
    for (const command of queue) {
      if (!merged.has(command.id)) merged.set(command.id, command);
    }
  }
  return [...merged.values()];
}

export function isCatStateStale(updatedAt: number, now = Date.now()): boolean {
  return now - updatedAt > STALE_MS;
}

function defaultRadioState(name: string): RadioState {
  return {
    connected: false,
    freq: 0,
    mode: "",
    name,
    tx: false,
    rfPower: 100,
    nbEnabled: false,
    nrEnabled: false,
    anfEnabled: false,
    apfEnabled: false,
    filterLo: 100,
    filterHi: 2800,
    rfGain: 0,
    rxAnt: "ANT1",
    txAnt: "ANT1",
    smeter: -127,
    fwdPower: 0,
    swr: 1.0,
    alc: 0,
    paTemp: 0,
  };
}

let catState: CatState = {
  connected: false,
  freq: 0,
  mode: "",
  station: "Maison",
  model: "FLEX-6600M",
  operationMode: "monitor",
  txControlAllowed: false,
  rfPower: 100,
  tuneActive: false,
  moxActive: false,
  nbEnabled: false,
  nrEnabled: false,
  anfEnabled: false,
  apfEnabled: false,
  rxAnt: "ANT1",
  txAnt: "ANT1",
  filterLo: 100,
  filterHi: 2800,
  rfGain: 0,
  rxPreset: "manual",
  eqEnabled: false,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0],
  smeter: -127,
  fwdPower: 0,
  swr: 1.0,
  alc: 0,
  paTemp: 0,
  updatedAt: 0,
};

let so2rState: So2rState = {
  enabled: false,
  roles: { run: "A", multi: "B" },
  radioA: defaultRadioState("Flex 6401"),
  radioB: defaultRadioState("Flex 8600"),
  updatedAt: 0,
};

// In-memory command queue (fallback when DB is unavailable or for same-instance delivery)
let inMemoryCommands: CatCommand[] = [];

function parsePersistedState(payload: string): CatState | null {
  try {
    const parsed = JSON.parse(payload) as Partial<CatState>;
    if (
      typeof parsed.updatedAt !== "number" ||
      typeof parsed.connected !== "boolean"
    )
      return null;
    return { ...catState, ...parsed };
  } catch {
    return null;
  }
}

// ─── SO2R Radio state schema ─────────────────────────────────────────────────

const radioStateSchema = z.object({
  connected: z.boolean(),
  freq: z.number(),
  mode: z.string(),
  name: z.string(),
  tx: z.boolean(),
  rfPower: z.number(),
  nbEnabled: z.boolean(),
  nrEnabled: z.boolean().optional(),
  anfEnabled: z.boolean().optional(),
  filterLo: z.number().optional(),
  filterHi: z.number().optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────────

export const catRelayRouter = router({
  /**
   * Bridge → Server : push radio state (called every 800ms by bridge)
   * Supports both single radio and SO2R mode.
   */
  push: publicProcedure
    .input(
      z.object({
        token: z.string(),
        connected: z.boolean(),
        freq: z.number().optional(),
        mode: z.string().optional(),
        radio: z.string().optional(),
        version: z.string().optional(),
        station: z.string().min(1).max(64).optional(),
        model: z.string().min(1).max(64).optional(),
        operationMode: z.enum(["monitor", "operate"]).optional(),
        txControlAllowed: z.boolean().optional(),
        // Flex control state (optional — bridge sends when available)
        rfPower: z.number().min(0).max(100).optional(),
        tuneActive: z.boolean().optional(),
        moxActive: z.boolean().optional(),
        nbEnabled: z.boolean().optional(),
        nrEnabled: z.boolean().optional(),
        anfEnabled: z.boolean().optional(),
        apfEnabled: z.boolean().optional(),
        rxAnt: z.string().optional(),
        txAnt: z.string().optional(),
        // RX Filter & DSP
        filterLo: z.number().optional(),
        filterHi: z.number().optional(),
        rfGain: z.number().min(-8).max(32).optional(),
        rxPreset: z.string().optional(),
        // EQ RX
        eqEnabled: z.boolean().optional(),
        eqBands: z.array(z.number()).length(8).optional(),
        // Telemetry (optional)
        smeter: z.number().optional(),
        fwdPower: z.number().optional(),
        swr: z.number().optional(),
        alc: z.number().optional(),
        paTemp: z.number().optional(),
        // SO2R fields (optional — only sent by bridge-so2r.mjs)
        so2r: z.boolean().optional(),
        roles: z.object({ run: z.string(), multi: z.string() }).optional(),
        radioA: radioStateSchema.optional(),
        radioB: radioStateSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!verifyToken(input.token, "CAT_BRIDGE_TOKEN")) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid bridge token",
        });
      }

      // Update single-radio state (always, for backward compat)
      catState = {
        connected: input.connected,
        freq: input.freq ?? catState.freq,
        mode: input.mode ?? catState.mode,
        radio: input.radio ?? catState.radio,
        version: input.version ?? catState.version,
        station: input.station ?? catState.station,
        model: input.model ?? catState.model,
        operationMode: input.operationMode ?? catState.operationMode,
        txControlAllowed: input.txControlAllowed ?? catState.txControlAllowed,
        rfPower: input.rfPower ?? catState.rfPower,
        tuneActive: input.tuneActive ?? catState.tuneActive,
        moxActive: input.moxActive ?? catState.moxActive,
        nbEnabled: input.nbEnabled ?? catState.nbEnabled,
        nrEnabled: input.nrEnabled ?? catState.nrEnabled,
        anfEnabled: input.anfEnabled ?? catState.anfEnabled,
        apfEnabled: input.apfEnabled ?? catState.apfEnabled,
        rxAnt: input.rxAnt ?? catState.rxAnt,
        txAnt: input.txAnt ?? catState.txAnt,
        filterLo: input.filterLo ?? catState.filterLo,
        filterHi: input.filterHi ?? catState.filterHi,
        rfGain: input.rfGain ?? catState.rfGain,
        rxPreset: input.rxPreset ?? catState.rxPreset,
        eqEnabled: input.eqEnabled ?? catState.eqEnabled,
        eqBands: input.eqBands ?? catState.eqBands,
        smeter: input.smeter ?? catState.smeter,
        fwdPower: input.fwdPower ?? catState.fwdPower,
        swr: input.swr ?? catState.swr,
        alc: input.alc ?? catState.alc,
        paTemp: input.paTemp ?? catState.paTemp,
        updatedAt: Date.now(),
      };

      // Update SO2R state if bridge sends it
      if (input.so2r && input.radioA && input.radioB && input.roles) {
        so2rState = {
          enabled: true,
          roles: input.roles,
          radioA: {
            ...so2rState.radioA,
            connected: input.radioA.connected,
            freq: input.radioA.freq,
            mode: input.radioA.mode,
            name: input.radioA.name,
            tx: input.radioA.tx,
            rfPower: input.radioA.rfPower,
            nbEnabled: input.radioA.nbEnabled,
            nrEnabled: input.radioA.nrEnabled ?? so2rState.radioA.nrEnabled,
            anfEnabled: input.radioA.anfEnabled ?? so2rState.radioA.anfEnabled,
            filterLo: input.radioA.filterLo ?? so2rState.radioA.filterLo,
            filterHi: input.radioA.filterHi ?? so2rState.radioA.filterHi,
          },
          radioB: {
            ...so2rState.radioB,
            connected: input.radioB.connected,
            freq: input.radioB.freq,
            mode: input.radioB.mode,
            name: input.radioB.name,
            tx: input.radioB.tx,
            rfPower: input.radioB.rfPower,
            nbEnabled: input.radioB.nbEnabled,
            nrEnabled: input.radioB.nrEnabled ?? so2rState.radioB.nrEnabled,
            anfEnabled: input.radioB.anfEnabled ?? so2rState.radioB.anfEnabled,
            filterLo: input.radioB.filterLo ?? so2rState.radioB.filterLo,
            filterHi: input.radioB.filterHi ?? so2rState.radioB.filterHi,
          },
          updatedAt: Date.now(),
        };
      } else if (!input.so2r) {
        // Single radio mode — disable SO2R
        so2rState.enabled = false;
      }

      // Return any pending commands from DB (cross-instance safe)
      // Commands are consumed once then deleted. One-shot delivery.
      let cmds: CatCommand[] = [];
      try {
        const db = await getDb();
        if (db) {
          // Partage l'état radio entre toutes les instances Autoscale.
          await db
            .insert(catRelayStates)
            .values({
              stateKey: "primary",
              payload: JSON.stringify(catState),
              updatedAt: new Date(catState.updatedAt),
            })
            .onDuplicateKeyUpdate({
              set: {
                payload: JSON.stringify(catState),
                updatedAt: new Date(catState.updatedAt),
              },
            });

          // Fenêtre assez large pour absorber un délai réseau. Les lignes sont
          // supprimées dès la première lecture : la livraison reste one-shot.
          const thirtySecsAgo = new Date(Date.now() - 30000);
          const rows = await db
            .select()
            .from(catCommands)
            .where(gt(catCommands.createdAt, thirtySecsAgo))
            .limit(20);
          if (rows.length > 0) {
            cmds = rows.map(r => JSON.parse(r.payload) as CatCommand);
            console.log(`[CAT] Returning ${cmds.length} commands from DB`);
            // DELETE consumed commands immediately (one-shot)
            const ids = rows.map(r => r.id);
            for (const id of ids) {
              await db.delete(catCommands).where(eq(catCommands.id, id));
            }
          }
          // Cleanup any stale commands (older than 10s)
          const tenSecsAgo = new Date(Date.now() - 10000);
          await db
            .delete(catCommands)
            .where(lt(catCommands.createdAt, tenSecsAgo));
        }
      } catch (err) {
        console.warn("[CAT] DB command fetch error:", err);
      }

      // Also drain in-memory queue (same-instance, one-shot)
      if (inMemoryCommands.length > 0) {
        cmds = mergeUniqueCatCommands(cmds, inMemoryCommands);
        inMemoryCommands = []; // drained = gone
      }
      return { ok: true, commands: cmds };
    }),

  /**
   * Browser → Server : get current radio state (polled every 1-2s by browser)
   */
  state: publicProcedure.query(async () => {
    let sharedState = catState;
    try {
      const db = await getDb();
      if (db) {
        const rows = await db
          .select()
          .from(catRelayStates)
          .where(eq(catRelayStates.stateKey, "primary"))
          .limit(1);
        const persisted = rows[0] ? parsePersistedState(rows[0].payload) : null;
        if (persisted && persisted.updatedAt > sharedState.updatedAt)
          sharedState = persisted;
      }
    } catch (err) {
      console.warn("[CAT] DB state read error:", err);
    }

    const isStale = isCatStateStale(sharedState.updatedAt);
    return {
      connected: isStale ? false : sharedState.connected,
      freq: sharedState.freq,
      mode: sharedState.mode,
      radio: sharedState.radio,
      version: sharedState.version,
      station: sharedState.station,
      model: sharedState.model,
      operationMode: sharedState.operationMode,
      txControlAllowed: sharedState.txControlAllowed,
      bridgeAlive: !isStale,
      updatedAt: sharedState.updatedAt,
      // Flex control state
      rfPower: sharedState.rfPower,
      tuneActive: sharedState.tuneActive,
      moxActive: sharedState.moxActive,
      nbEnabled: sharedState.nbEnabled,
      nrEnabled: sharedState.nrEnabled,
      anfEnabled: sharedState.anfEnabled,
      apfEnabled: sharedState.apfEnabled,
      rxAnt: sharedState.rxAnt,
      txAnt: sharedState.txAnt,
      // RX Filter
      filterLo: sharedState.filterLo,
      filterHi: sharedState.filterHi,
      rfGain: sharedState.rfGain,
      rxPreset: sharedState.rxPreset,
      // EQ RX
      eqEnabled: sharedState.eqEnabled,
      eqBands: sharedState.eqBands,
      // Telemetry
      smeter: sharedState.smeter,
      fwdPower: sharedState.fwdPower,
      swr: sharedState.swr,
      alc: sharedState.alc,
      paTemp: sharedState.paTemp,
      // SO2R state
      so2r: so2rState.enabled,
      so2rRoles: so2rState.roles,
      so2rRadioA: so2rState.enabled ? so2rState.radioA : undefined,
      so2rRadioB: so2rState.enabled ? so2rState.radioB : undefined,
    };
  }),

  /**
   * Browser → Server : send a command to the bridge (QSY, split, etc.)
   * Extended for SO2R: supports target radio and SO2R-specific actions.
   */
  command: adminProcedure
    .input(
      z.object({
        action: z.enum([
          "qsy",
          "split",
          "status",
          // Flex control commands (WAN-safe)
          "setpower",
          "tune",
          "mox",
          "dsp",
          // RX Filter commands
          "setfilter",
          "setpreset",
          // SO2R commands
          "swap",
          "qsy_multi",
          "qsy_run",
          "swap_and_qsy",
        ]),
        freq: z.number().optional(),
        txFreq: z.number().optional(),
        rxFreq: z.number().optional(),
        mode: z.string().optional(),
        slice: z.number().optional(),
        // Flex control params
        value: z.number().optional(),
        enabled: z.boolean().optional(),
        param: z.string().optional(),
        type: z.string().optional(),
        ant: z.string().optional(),
        // Filter/EQ params
        filterLo: z.number().optional(),
        filterHi: z.number().optional(),
        rfGain: z.number().min(-8).max(32).optional(),
        preset: z.string().optional(),
        eqBands: z.array(z.number()).length(8).optional(),
        // Spot params
        callsign: z.string().optional(),
        color: z.string().optional(),
        // SO2R params
        target: z.enum(["A", "B", "run", "multi"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (
        (input.action === "mox" || input.action === "tune") &&
        !catState.txControlAllowed
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Contrôle TX bloqué : le bridge Maison n’a pas reçu une autorisation explicite.",
        });
      }
      const cmd: CatCommand = {
        id: createCatCommandId(),
        action: input.action,
        freq: input.freq,
        txFreq: input.txFreq,
        rxFreq: input.rxFreq,
        mode: input.mode,
        slice: input.slice,
        value: input.value,
        enabled: input.enabled,
        param: input.param,
        type: input.type,
        ant: input.ant,
        filterLo: input.filterLo,
        filterHi: input.filterHi,
        rfGain: input.rfGain,
        preset: input.preset,
        eqBands: input.eqBands,
        callsign: input.callsign,
        color: input.color,
        target: input.target,
        createdAt: Date.now(),
      };

      // Store command in memory (always) + database (for cross-instance)
      inMemoryCommands.push(cmd);
      console.log(
        `[CAT] Command ${cmd.id} queued in memory (${inMemoryCommands.length} total)`
      );
      try {
        const db = await getDb();
        if (db) {
          await db.insert(catCommands).values({ payload: JSON.stringify(cmd) });
          console.log(`[CAT] Command ${cmd.id} inserted in DB`);
        } else {
          console.warn(
            `[CAT] DB unavailable — command ${cmd.id} only in memory`
          );
        }
      } catch (err) {
        console.warn("[CAT] DB command insert error:", err);
      }

      return { ok: true, commandId: cmd.id };
    }),
});
