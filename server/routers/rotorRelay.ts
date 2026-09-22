/**
 * rotorRelay — relais sécurisé entre DX Hunter et le bridge ARCO local de Maison.
 *
 * Le serveur ne contacte jamais directement un pupitre ARCO ni son VNC. Le bridge
 * installé sur le MacBook Pro est le seul composant qui connaît l'adresse locale
 * du contrôleur ; il pousse la télémétrie et récupère une file de commandes brève.
 * Le mode par défaut est `monitor` : aucune commande de mouvement n'est distribuée.
 */
import { TRPCError } from "@trpc/server";
import { eq, gt, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rotorCommands, rotorRelayStates } from "../../drizzle/schema";
import { verifyToken } from "../_core/bridgeToken";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

const STALE_MS = 15_000;
const COMMAND_TTL_MS = 10_000;

export interface RotorCommand {
  id: string;
  action: "goto" | "stop";
  azimuth?: number;
  createdAt: number;
}

interface RotorState {
  connected: boolean;
  azimuth: number | null;
  targetAzimuth: number | null;
  moving: boolean;
  status: string;
  station: string;
  controller: string;
  operationMode: "monitor" | "operate";
  motionAllowed: boolean;
  localControl: boolean;
  errorMessage: string | null;
  updatedAt: number;
}

let rotorState: RotorState = {
  connected: false,
  azimuth: null,
  targetAzimuth: null,
  moving: false,
  status: "waiting-for-local-bridge",
  station: "Maison",
  controller: "microHAM ARCO",
  operationMode: "monitor",
  motionAllowed: false,
  localControl: false,
  errorMessage: null,
  updatedAt: 0,
};

let inMemoryCommands: RotorCommand[] = [];

export function createRotorCommandId(
  now = Date.now(),
  uuid = randomUUID()
): string {
  return `rot-${now}-${uuid.slice(0, 8)}`;
}

export function isRotorStateStale(
  updatedAt: number,
  now = Date.now()
): boolean {
  return now - updatedAt > STALE_MS;
}

function parsePersistedState(payload: string): RotorState | null {
  try {
    const parsed = JSON.parse(payload) as Partial<RotorState>;
    if (
      typeof parsed.updatedAt !== "number" ||
      typeof parsed.connected !== "boolean"
    )
      return null;
    return { ...rotorState, ...parsed };
  } catch {
    return null;
  }
}

function mergeUniqueCommands(...queues: RotorCommand[][]): RotorCommand[] {
  const merged = new Map<string, RotorCommand>();
  for (const queue of queues) {
    for (const command of queue) {
      if (!merged.has(command.id)) merged.set(command.id, command);
    }
  }
  return [...merged.values()];
}

async function consumePendingCommands(): Promise<RotorCommand[]> {
  let commands: RotorCommand[] = [];
  try {
    const db = await getDb();
    if (db) {
      await db
        .insert(rotorRelayStates)
        .values({
          stateKey: "maison",
          payload: JSON.stringify(rotorState),
          updatedAt: new Date(rotorState.updatedAt),
        })
        .onDuplicateKeyUpdate({
          set: {
            payload: JSON.stringify(rotorState),
            updatedAt: new Date(rotorState.updatedAt),
          },
        });

      const recent = new Date(Date.now() - COMMAND_TTL_MS);
      const rows = await db
        .select()
        .from(rotorCommands)
        .where(gt(rotorCommands.createdAt, recent))
        .limit(10);
      if (rows.length > 0) {
        commands = rows.map(row => JSON.parse(row.payload) as RotorCommand);
        for (const row of rows) {
          await db.delete(rotorCommands).where(eq(rotorCommands.id, row.id));
        }
      }
      await db.delete(rotorCommands).where(lt(rotorCommands.createdAt, recent));
    }
  } catch (error) {
    console.warn(
      "[ARCO] Échec de synchronisation de la file de commandes :",
      error
    );
  }

  if (inMemoryCommands.length > 0) {
    commands = mergeUniqueCommands(commands, inMemoryCommands);
    inMemoryCommands = [];
  }
  return commands;
}

async function getSharedState(): Promise<RotorState> {
  let sharedState = rotorState;
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(rotorRelayStates)
        .where(eq(rotorRelayStates.stateKey, "maison"))
        .limit(1);
      const persisted = rows[0] ? parsePersistedState(rows[0].payload) : null;
      if (persisted && persisted.updatedAt > sharedState.updatedAt)
        sharedState = persisted;
    }
  } catch (error) {
    console.warn("[ARCO] Échec de lecture de l'état partagé :", error);
  }
  return sharedState;
}

function requireArcoBridgeToken(token: string): void {
  if (!verifyToken(token, "ARCO_BRIDGE_TOKEN")) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Jeton ARCO invalide.",
    });
  }
}

export const rotorRelayRouter = router({
  /** Bridge local ARCO → DX Hunter : télémétrie confirmée et récupération de commandes. */
  push: publicProcedure
    .input(
      z.object({
        token: z.string(),
        connected: z.boolean(),
        azimuth: z.number().min(0).max(360).nullable().optional(),
        targetAzimuth: z.number().min(0).max(360).nullable().optional(),
        moving: z.boolean().optional(),
        status: z.string().min(1).max(80).optional(),
        station: z.string().min(1).max(64).optional(),
        controller: z.string().min(1).max(64).optional(),
        operationMode: z.enum(["monitor", "operate"]).optional(),
        motionAllowed: z.boolean().optional(),
        localControl: z.boolean().optional(),
        errorMessage: z.string().max(250).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      requireArcoBridgeToken(input.token);
      rotorState = {
        connected: input.connected,
        azimuth: input.azimuth ?? rotorState.azimuth,
        targetAzimuth: input.targetAzimuth ?? rotorState.targetAzimuth,
        moving: input.moving ?? rotorState.moving,
        status: input.status ?? rotorState.status,
        station: input.station ?? rotorState.station,
        controller: input.controller ?? rotorState.controller,
        operationMode: input.operationMode ?? rotorState.operationMode,
        motionAllowed: input.motionAllowed ?? rotorState.motionAllowed,
        localControl: input.localControl ?? rotorState.localControl,
        errorMessage: input.errorMessage ?? rotorState.errorMessage,
        updatedAt: Date.now(),
      };
      return { ok: true, commands: await consumePendingCommands() };
    }),

  /** Navigateur → DX Hunter : dernière télémétrie confirmée par le bridge Maison. */
  state: publicProcedure.query(async () => {
    const state = await getSharedState();
    const stale = isRotorStateStale(state.updatedAt);
    return {
      ...state,
      connected: stale ? false : state.connected,
      moving: stale ? false : state.moving,
      bridgeAlive: !stale,
      reachable: !stale,
      motionAllowed: stale ? false : state.motionAllowed,
    };
  }),

  /** Mouvement explicite uniquement : interdit en monitor, sans bridge ou avec priorité locale. */
  goTo: adminProcedure
    .input(z.object({ azimuth: z.number().min(0).max(360) }))
    .mutation(async ({ input }) => {
      const state = await getSharedState();
      if (isRotorStateStale(state.updatedAt) || !state.connected) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bridge ARCO Maison indisponible.",
        });
      }
      if (state.operationMode !== "operate" || !state.motionAllowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Mouvement ARCO bloqué : mode lecture seule actif.",
        });
      }
      if (state.localControl) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Mouvement ARCO bloqué : priorité au pupitre local.",
        });
      }

      const command: RotorCommand = {
        id: createRotorCommandId(),
        action: "goto",
        azimuth: input.azimuth,
        createdAt: Date.now(),
      };
      inMemoryCommands.push(command);
      try {
        const db = await getDb();
        if (db)
          await db
            .insert(rotorCommands)
            .values({ payload: JSON.stringify(command) });
      } catch (error) {
        console.warn(
          "[ARCO] Échec d'ajout de la commande de mouvement :",
          error
        );
      }
      return { ok: true, commandId: command.id };
    }),

  /** STOP reste disponible afin de pouvoir interrompre un mouvement volontaire. */
  stop: adminProcedure.mutation(async () => {
    const command: RotorCommand = {
      id: createRotorCommandId(),
      action: "stop",
      createdAt: Date.now(),
    };
    inMemoryCommands.push(command);
    try {
      const db = await getDb();
      if (db)
        await db
          .insert(rotorCommands)
          .values({ payload: JSON.stringify(command) });
    } catch (error) {
      console.warn("[ARCO] Échec d'ajout de la commande STOP :", error);
    }
    return { ok: true, commandId: command.id };
  }),
});
