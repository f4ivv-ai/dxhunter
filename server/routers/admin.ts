import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { listAllUsers, setUserSubscription } from "../db";

export const adminRouter = router({
  /** List all registered users with their subscription status */
  listUsers: adminProcedure.query(async () => {
    const users = await listAllUsers();
    return users.map((u) => ({
      id: u.id,
      openId: u.openId,
      name: u.name,
      email: u.email,
      role: u.role,
      subscription: u.subscription,
      subscriptionExpiry: u.subscriptionExpiry,
      locator: u.locator,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn,
    }));
  }),

  /** Toggle premium subscription for a user */
  setSubscription: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        subscription: z.enum(["free", "premium"]),
        /** Optional expiry date (ISO string). Null = never expires. */
        expiryDate: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const expiry = input.expiryDate ? new Date(input.expiryDate) : null;
      await setUserSubscription(input.userId, input.subscription, expiry);
      return { success: true };
    }),
});
