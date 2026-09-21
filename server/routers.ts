import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { spotsRouter } from "./routers/spots";
import { websdrRouter } from "./routers/websdr";
import { workedRouter } from "./routers/worked";
import { adminRouter } from "./routers/admin";
import { catRelayRouter } from "./routers/catRelay";
import { rotorRelayRouter } from "./routers/rotorRelay";
import { logbookRouter } from "./routers/logbook";
import { dxccRouter } from "./routers/dxcc";
import { settingsRouter } from "./routers/settings";
import { dxinfoRouter } from "./routers/dxinfo";
import { contestRouter } from "./routers/contest";
import { antennaRelayRouter } from "./routers/antennaRelay";
import { ecouteDxRouter } from "./routers/ecouteDx";
import { presencePing, getPresenceCount } from "./presence";
import { z } from "zod";
import { updateUserLocator } from "./db";

export const appRouter = router({
  system: systemRouter,
  spots: spotsRouter,
  websdr: websdrRouter,
  worked: workedRouter,
  admin: adminRouter,
  cat: catRelayRouter,
  rotor: rotorRelayRouter,
  logbook: logbookRouter,
  dxcc: dxccRouter,
  settings: settingsRouter,
  dxinfo: dxinfoRouter,
  contest: contestRouter,
  antenna: antennaRelayRouter,
  ecouteDx: ecouteDxRouter,
  profile: router({
    /** Update user's QTH locator */
    setLocator: protectedProcedure
      .input(z.object({ locator: z.string().min(4).max(8).regex(/^[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2}([0-9]{2})?)?$/, "Invalid Maidenhead locator") }))
      .mutation(async ({ ctx, input }) => {
        await updateUserLocator(ctx.user.openId, input.locator.toUpperCase());
        return { success: true };
      }),
  }),
  presence: router({
    ping: publicProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(({ input }) => {
        const count = presencePing(input.sessionId);
        return { count };
      }),
    count: publicProcedure.query(() => {
      return { count: getPresenceCount() };
    }),
  }),
  subscription: router({
    /** Get current user's subscription status with trial info */
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      const TRIAL_DAYS = 10;

      // Admin always has full access
      if (user.role === "admin") {
        return { plan: "premium" as const, trialActive: false, daysLeft: 0, hasAccess: true };
      }

      // Premium subscriber
      if (user.subscription === "premium") {
        // Check expiry
        if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date()) {
          return { plan: "free" as const, trialActive: false, daysLeft: 0, hasAccess: false };
        }
        return { plan: "premium" as const, trialActive: false, daysLeft: 0, hasAccess: true };
      }

      // Free user — check trial
      if (user.trialStartDate) {
        const start = new Date(user.trialStartDate).getTime();
        const elapsed = Date.now() - start;
        const daysElapsed = Math.floor(elapsed / 86400_000);
        const daysLeft = Math.max(0, TRIAL_DAYS - daysElapsed);
        if (daysLeft > 0) {
          return { plan: "trial" as const, trialActive: true, daysLeft, hasAccess: true };
        }
      }

      // Trial expired or never started
      return { plan: "free" as const, trialActive: false, daysLeft: 0, hasAccess: false };
    }),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
