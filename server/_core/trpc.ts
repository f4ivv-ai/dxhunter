import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requirePremium = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Admin always has premium access
  if (ctx.user.role === 'admin') {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  if (ctx.user.subscription !== 'premium') {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Premium subscription required. Upgrade to access this feature.",
    });
  }

  // Check expiry if set
  if (ctx.user.subscriptionExpiry && new Date(ctx.user.subscriptionExpiry) < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your premium subscription has expired. Please renew.",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const premiumProcedure = t.procedure.use(requirePremium);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
