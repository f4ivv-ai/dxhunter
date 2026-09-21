import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const sampleSpot = {
  id: "abc",
  dx_call: "9M0XYZ",
  dx_country: "Spratly",
  dx_continent: "AS",
  band: "20m",
  mode: "SSB",
  mode_type: "PHONE",
  freq: 14195000,
  received_time: Date.now() / 1000,
};

describe("spots.list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie les spots proxifiés quand les APIs répondent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [sampleSpot],
      })) as unknown as typeof fetch
    );

    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.spots.list({ maxAge: 7200, limit: 10 });

    expect(res.ok).toBe(true);
    // Au moins 1 spot (Spothole renvoie sampleSpot, DX Summit aussi car même mock)
    expect(res.count).toBeGreaterThanOrEqual(1);
    expect(res.spots.some((s: any) => s.dx_call === "9M0XYZ")).toBe(true);
  });

  it("renvoie ok=true avec 0 spots et warnings quand les deux APIs échouent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })) as unknown as typeof fetch
    );

    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.spots.list({ maxAge: 7200, limit: 10 });

    // Le nouveau comportement est tolérant : ok=true même si les sources échouent
    expect(res.ok).toBe(true);
    expect(res.count).toBe(0);
    expect(res.spots).toHaveLength(0);
    // Des warnings sont remontés
    expect((res as any).warnings).toBeDefined();
    expect((res as any).warnings.length).toBeGreaterThan(0);
  });

  it("applique les valeurs par défaut sans input", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.spots.list();

    expect(res.ok).toBe(true);
    // L'URL appelée doit contenir les 6 bandes suivies et max_age par défaut
    const calledUrl = (fetchMock as unknown as { mock: { calls: any[][] } }).mock.calls[0][0] as string;
    expect(calledUrl).toContain("band=160m,80m,60m,40m,30m,20m,17m,15m,12m,10m,6m,4m,2m,70cm");
    expect(calledUrl).toContain("max_age=7200");
  });
});

describe("spots.solar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie les données solaires quand l'API répond", async () => {
    const solarPayload = { sfi: 195, a_index: 8, k_index: 0, sunspots: 129 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => solarPayload,
      })) as unknown as typeof fetch
    );

    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.spots.solar();

    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ sfi: 195, k_index: 0 });
  });

  it("renvoie ok=false et data=null quand l'API échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })) as unknown as typeof fetch
    );

    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.spots.solar();

    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
  });
});
