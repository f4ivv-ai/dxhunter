import { describe, expect, it } from "vitest";
import {
  createCatCommandId,
  getCatCommandBlockReason,
  isCatStateStale,
  mergeUniqueCatCommands,
  type CatCommand,
} from "./routers/catRelay";

function command(id: string, action = "qsy"): CatCommand {
  return { id, action, freq: 14.23, createdAt: 1 };
}

describe("CAT Relay V32b", () => {
  it("génère des IDs distincts entre instances même au même instant", () => {
    const first = createCatCommandId(
      1_700_000_000_000,
      "aaaaaaaa-1111-1111-1111-111111111111"
    );
    const second = createCatCommandId(
      1_700_000_000_000,
      "bbbbbbbb-2222-2222-2222-222222222222"
    );
    expect(first).toBe("cmd-1700000000000-aaaaaaaa");
    expect(second).not.toBe(first);
  });

  it("fusionne DB et mémoire sans rejouer deux fois le même QSY", () => {
    const merged = mergeUniqueCatCommands(
      [command("cmd-a"), command("cmd-b")],
      [command("cmd-a"), command("cmd-c", "status")]
    );
    expect(merged.map(item => item.id)).toEqual(["cmd-a", "cmd-b", "cmd-c"]);
  });

  it("garde l’état vivant pendant 15 secondes puis le marque périmé", () => {
    expect(isCatStateStale(1_000, 16_000)).toBe(false);
    expect(isCatStateStale(1_000, 16_001)).toBe(true);
  });

  it("autorise QSY et réglages RX, mais jamais TX, dans le mode receive", () => {
    expect(getCatCommandBlockReason("receive", false, "qsy")).toBeNull();
    expect(getCatCommandBlockReason("receive", false, "setfilter")).toBeNull();
    expect(getCatCommandBlockReason("receive", false, "mox")).toContain(
      "réglages RX"
    );
    expect(getCatCommandBlockReason("receive", false, "setpower")).toContain(
      "réglages RX"
    );
  });

  it("bloque toutes les commandes en monitor et exige une autorisation TX en operate", () => {
    expect(getCatCommandBlockReason("monitor", false, "qsy")).toContain(
      "lecture seule"
    );
    expect(getCatCommandBlockReason("operate", false, "tune")).toContain(
      "Contrôle TX bloqué"
    );
    expect(getCatCommandBlockReason("operate", true, "tune")).toBeNull();
  });
});
