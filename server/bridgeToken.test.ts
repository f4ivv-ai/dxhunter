import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getConfiguredToken, verifyToken } from "./_core/bridgeToken";
import { contestQsoHandler } from "./contestEndpoint";
import { appRouter } from "./routers";
import type { Request, Response } from "express";

const GOOD = "x7Kq-9Vb2mLp4Rt8Wz1Nc6Yd3Hs5Jf0A";

function contextFor(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role
      ? {
          id: role === "admin" ? 1 : 2,
          openId: `${role}-test`,
          email: `${role}@example.test`,
          name: role,
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("Jetons bridge — échec fermé", () => {
  it("refuse tout quand aucun jeton n'est configuré", () => {
    expect(getConfiguredToken("CAT_BRIDGE_TOKEN", {})).toBeNull();
    expect(verifyToken("n'importe quoi", "CAT_BRIDGE_TOKEN", {})).toBe(false);
    expect(verifyToken("", "CAT_BRIDGE_TOKEN", { CAT_BRIDGE_TOKEN: "" })).toBe(false);
  });

  it("refuse l'ancien jeton public, même configuré par erreur", () => {
    const oldPublishedToken = ["dxhunter", "cat", "2024"].join("-");
    const env = { CAT_BRIDGE_TOKEN: oldPublishedToken };
    expect(getConfiguredToken("CAT_BRIDGE_TOKEN", env)).toBeNull();
    expect(verifyToken(oldPublishedToken, "CAT_BRIDGE_TOKEN", env)).toBe(false);
  });

  it("refuse un jeton configuré trop court", () => {
    expect(verifyToken("court", "CAT_BRIDGE_TOKEN", { CAT_BRIDGE_TOKEN: "court" })).toBe(false);
  });

  it("accepte uniquement le jeton exact", () => {
    const env = { CAT_BRIDGE_TOKEN: GOOD };
    expect(verifyToken(GOOD, "CAT_BRIDGE_TOKEN", env)).toBe(true);
    expect(verifyToken(`${GOOD}x`, "CAT_BRIDGE_TOKEN", env)).toBe(false);
    expect(verifyToken(GOOD.slice(1), "CAT_BRIDGE_TOKEN", env)).toBe(false);
    expect(verifyToken(undefined, "CAT_BRIDGE_TOKEN", env)).toBe(false);
  });
});

describe("Endpoints de contrôle radio/antenne — accès", () => {
  const saved = process.env.CAT_BRIDGE_TOKEN;
  afterEach(() => {
    if (saved === undefined) delete process.env.CAT_BRIDGE_TOKEN;
    else process.env.CAT_BRIDGE_TOKEN = saved;
  });

  it.runIf(Boolean(process.env.CAT_BRIDGE_TOKEN))(
    "accepte le jeton CAT privé configuré via un appel tRPC léger",
    async () => {
    const configured = process.env.CAT_BRIDGE_TOKEN;
    expect(configured).toBeTruthy();
    expect(configured!.length).toBeGreaterThanOrEqual(24);

    const result = await appRouter.createCaller(contextFor(null)).antenna.push({
      token: configured!,
      connected: false,
    });
    expect(result).toMatchObject({ ok: true, commands: [] });
    },
  );

  for (const action of ["mox", "tune", "setpower", "qsy"] as const) {
    it(`cat.command '${action}' refusé à un visiteur anonyme`, async () => {
      const caller = appRouter.createCaller(contextFor(null));
      await expect(caller.cat.command({ action, enabled: true, value: 50 }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it(`cat.command '${action}' refusé à un utilisateur non admin`, async () => {
      const caller = appRouter.createCaller(contextFor("user"));
      await expect(caller.cat.command({ action, enabled: true, value: 50 }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  }

  it("antenna.command refusé à un visiteur anonyme et à un non-admin", async () => {
    await expect(appRouter.createCaller(contextFor(null)).antenna.command({ action: "select", port: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(contextFor("user")).antenna.command({ action: "select", port: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cat.push avec l'ancien jeton public est refusé", async () => {
    process.env.CAT_BRIDGE_TOKEN = GOOD;
    const caller = appRouter.createCaller(contextFor(null));
    const oldPublishedToken = ["dxhunter", "cat", "2024"].join("-");
    await expect(caller.cat.push({ token: oldPublishedToken, connected: true }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("cat.push sans jeton serveur configuré est refusé", async () => {
    delete process.env.CAT_BRIDGE_TOKEN;
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.cat.push({ token: GOOD, connected: true }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("antenna.push avec un mauvais jeton est refusé", async () => {
    process.env.CAT_BRIDGE_TOKEN = GOOD;
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.antenna.push({ token: "faux", connected: true }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("Endpoint concours — accès", () => {
  function responseRecorder() {
    let statusCode = 200;
    let body: unknown;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(value: unknown) {
        body = value;
        return this;
      },
    } as unknown as Response;
    return {
      response,
      result: () => ({ statusCode, body }),
    };
  }

  it("refuse un jeton concours incorrect avant tout accès base", async () => {
    const { response, result } = responseRecorder();
    await contestQsoHandler({
      headers: { authorization: "Bearer jeton-invalide" },
      body: {},
    } as Request, response);
    expect(result()).toEqual({ statusCode: 401, body: { error: "Unauthorized" } });
  });

  it.runIf(Boolean(process.env.CONTEST_TOKEN))(
    "accepte le jeton concours privé configuré",
    async () => {
      const { response, result } = responseRecorder();
      await contestQsoHandler({
        headers: { authorization: `Bearer ${process.env.CONTEST_TOKEN}` },
        body: {},
      } as Request, response);
      expect(result()).toEqual({ statusCode: 400, body: { error: "Missing action" } });
    },
  );
});
