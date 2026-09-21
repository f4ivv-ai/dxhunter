import { describe, expect, it } from "vitest";
import {
  buildPrimaryKiwiTuneUrl,
  primaryKiwiMode,
} from "../shared/primaryKiwi";

describe("KiwiSDR F4IVV — lien direct accordé", () => {
  it("cale un spot 20 m en USB sur le Kiwi de Marcilloles", () => {
    expect(buildPrimaryKiwiTuneUrl(14_230, "SSB")).toBe(
      "http://23147.proxy.kiwisdr.com:8073/?f=14230.00/usb&z=10",
    );
  });

  it("cale un spot 40 m SSB en LSB", () => {
    expect(buildPrimaryKiwiTuneUrl(7_185, "SSB")).toBe(
      "http://23147.proxy.kiwisdr.com:8073/?f=7185.00/lsb&z=10",
    );
  });

  it("conserve les modes CW et numériques adaptés à KiwiSDR", () => {
    expect(primaryKiwiMode(7_025, "CW")).toBe("cw");
    expect(primaryKiwiMode(7_074, "FT8")).toBe("usb");
  });
});
