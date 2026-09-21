/**
 * Antenna Genius Relay Router — HTTP-based relay for Antenna Genius bridge ↔ browser.
 *
 * Architecture (same pattern as catRelay) :
 * 1. Le bridge local se connecte au Antenna Genius via TCP port 9007 (GSCP protocol)
 * 2. Le bridge fait des POST vers `antenna.push` avec l'état des antennes
 * 3. Le navigateur poll via `antenna.state` toutes les 2s
 * 4. Le navigateur envoie des commandes via `antenna.command`
 */
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifyToken } from "../_core/bridgeToken";

const STALE_MS = 6000;

// ─── In-memory state ────────────────────────────────────────────────────────

interface AntennaState {
  connected: boolean;
  selectedPort: number; // 1-8 (port actif)
  portCount: number; // nombre de ports disponibles
  portNames: string[]; // noms des antennes ["20m Yagi", "40m Dipole", ...]
  bandMap: Record<string, number>; // { "20m": 1, "40m": 2 } — auto-band mapping
  autoBand: boolean; // commutation automatique par bande
  updatedAt: number;
}

interface AntennaCommand {
  id: string;
  action: string;
  port?: number;
  enabled?: boolean;
  createdAt: number;
}

let antennaState: AntennaState = {
  connected: false,
  selectedPort: 1,
  portCount: 4,
  portNames: ["Port 1", "Port 2", "Port 3", "Port 4"],
  bandMap: {},
  autoBand: true,
  updatedAt: 0,
};

let pendingCommands: AntennaCommand[] = [];
let commandCounter = 0;

// ─── Router ─────────────────────────────────────────────────────────────────

export const antennaRelayRouter = router({
  /**
   * Bridge → Server : push antenna state
   */
  push: publicProcedure
    .input(
      z.object({
        token: z.string(),
        connected: z.boolean(),
        selectedPort: z.number().min(1).max(8).optional(),
        portCount: z.number().min(1).max(8).optional(),
        portNames: z.array(z.string()).optional(),
        bandMap: z.record(z.string(), z.number()).optional(),
        autoBand: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      if (!verifyToken(input.token, "CAT_BRIDGE_TOKEN")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid bridge token" });
      }
      antennaState = {
        connected: input.connected,
        selectedPort: input.selectedPort ?? antennaState.selectedPort,
        portCount: input.portCount ?? antennaState.portCount,
        portNames: input.portNames ?? antennaState.portNames,
        bandMap: input.bandMap ?? antennaState.bandMap,
        autoBand: input.autoBand ?? antennaState.autoBand,
        updatedAt: Date.now(),
      };
      const cmds = [...pendingCommands];
      pendingCommands = [];
      return { ok: true, commands: cmds };
    }),

  /**
   * Browser → Server : get current antenna state
   */
  state: publicProcedure.query(() => {
    const isStale = Date.now() - antennaState.updatedAt > STALE_MS;
    return {
      connected: isStale ? false : antennaState.connected,
      selectedPort: antennaState.selectedPort,
      portCount: antennaState.portCount,
      portNames: antennaState.portNames,
      bandMap: antennaState.bandMap,
      autoBand: antennaState.autoBand,
      bridgeAlive: !isStale,
    };
  }),

  /**
   * Browser → Server : send command to Antenna Genius via bridge
   */
  command: adminProcedure
    .input(
      z.object({
        action: z.enum(["select", "autoband"]),
        port: z.number().min(1).max(8).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      commandCounter++;
      const cmd: AntennaCommand = {
        id: `ant-${commandCounter}`,
        action: input.action,
        port: input.port,
        enabled: input.enabled,
        createdAt: Date.now(),
      };
      pendingCommands.push(cmd);
      if (pendingCommands.length > 10) {
        pendingCommands = pendingCommands.slice(-10);
      }
      return { ok: true, commandId: cmd.id };
    }),
});
