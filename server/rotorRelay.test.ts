import { describe, expect, it } from "vitest";
import { createRotorCommandId, isRotorStateStale } from "./routers/rotorRelay";

describe("ARCO rotor relay", () => {
  it("génère des identifiants de commande distincts", () => {
    const first = createRotorCommandId(
      1_700_000_000_000,
      "aaaaaaaa-1111-1111-1111-111111111111"
    );
    const second = createRotorCommandId(
      1_700_000_000_000,
      "bbbbbbbb-2222-2222-2222-222222222222"
    );
    expect(first).toBe("rot-1700000000000-aaaaaaaa");
    expect(second).not.toBe(first);
  });

  it("marque la télémétrie ARCO comme périmée après quinze secondes", () => {
    expect(isRotorStateStale(1_000, 16_000)).toBe(false);
    expect(isRotorStateStale(1_000, 16_001)).toBe(true);
  });
});
