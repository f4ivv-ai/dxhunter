import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function contextFor(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-test`,
      email: `${role}@example.test`,
      name: role,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Écoute DX — contrôle d’accès serveur", () => {
  it("refuse une recherche à un utilisateur non administrateur", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.ecouteDx.search({
      freqKhz: 14230,
      mode: "SSB",
      azimuth: 30,
      path: "SP",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuse aussi la recherche d’indicatif à un utilisateur non administrateur", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.ecouteDx.lookupCall({ callsign: "F4IVV" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("autorise la surveillance à un administrateur", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ spots: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    try {
      const caller = appRouter.createCaller(contextFor("admin"));
      const result = await caller.ecouteDx.watchMatches({
        freqKhz: 14230,
        mode: "SSB",
        launchedAt: Date.now(),
        knownIds: [],
      });
      expect(result).toEqual({ matches: [], checkedAt: expect.any(Number) });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
