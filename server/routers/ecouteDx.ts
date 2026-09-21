import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  findSpotCandidates,
  getPrimaryKiwiStatus,
  lookupCallsign,
  modeToleranceKhz,
  rankCorridorReceivers,
  resolveQth,
} from "../ecouteDx";

const searchInput = z.object({
  freqKhz: z.number().min(1800).max(54000),
  mode: z.string().min(1).max(24).default("SSB"),
  azimuth: z.number().min(0).max(359.999),
  path: z.enum(["SP", "LP"]),
  locator: z.string().min(4).max(8).optional(),
});

export const ecouteDxRouter = router({
  primaryKiwi: adminProcedure.query(() => getPrimaryKiwiStatus()),

  search: adminProcedure
    .input(searchInput)
    .mutation(async ({ ctx, input }) => {
      const launchedAt = Date.now();
      const locator = input.locator ?? ctx.user.locator ?? undefined;
      const qth = resolveQth(locator);
      const [candidates, corridor] = await Promise.all([
        findSpotCandidates(input.freqKhz, input.mode, launchedAt),
        rankCorridorReceivers({
          freqKhz: input.freqKhz,
          mode: input.mode,
          azimuth: input.azimuth,
          path: input.path,
          visitorId: ctx.user.openId,
          qthLat: qth.lat,
          qthLon: qth.lon,
        }),
      ]);

      return {
        frozen: {
          freqKhz: input.freqKhz,
          mode: input.mode,
          azimuth: Math.round(input.azimuth),
          path: input.path,
          launchedAt,
          qthLocator: qth.locator,
        },
        historyHours: 6,
        toleranceKhz: modeToleranceKhz(input.mode),
        candidates,
        corridorBearing: corridor.corridorBearing,
        receivers: corridor.receivers,
      };
    }),

  lookupCall: adminProcedure
    .input(z.object({
      callsign: z.string().trim().min(2).max(20),
      locator: z.string().min(4).max(8).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return lookupCallsign(input.callsign, input.locator ?? ctx.user.locator ?? undefined);
    }),

  watchMatches: adminProcedure
    .input(z.object({
      freqKhz: z.number().min(1800).max(54000),
      mode: z.string().min(1).max(24),
      launchedAt: z.number().int().positive(),
      knownIds: z.array(z.string()).max(500).default([]),
    }))
    .query(async ({ input }) => {
      const known = new Set(input.knownIds);
      const candidates = await findSpotCandidates(input.freqKhz, input.mode, Date.now());
      const matches = candidates.filter(
        (candidate) => candidate.spottedAt >= input.launchedAt && !known.has(candidate.id),
      );
      return { matches, checkedAt: Date.now() };
    }),
});
