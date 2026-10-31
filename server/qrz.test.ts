import { describe, it, expect } from "vitest";
import { qrzTestConnection, qrzLookup } from "./qrz";
import { scpSearch, scpCount } from "./scp";

// Tests réseau : exécutés seulement si les identifiants QRZ sont fournis.
describe.skipIf(!process.env.QRZ_USERNAME || !process.env.QRZ_PASSWORD)("QRZ XML API", () => {
  it("should authenticate with QRZ.com", async () => {
    const connected = await qrzTestConnection();
    expect(connected).toBe(true);
  }, 15000);

  it("should lookup a known callsign (F4IVV)", async () => {
    const info = await qrzLookup("F4IVV");
    expect(info).not.toBeNull();
    expect(info?.call).toBe("F4IVV");
    expect(info?.country).toBeTruthy();
  }, 15000);
});

describe("Super Check Partial", () => {
  it("should load the MASTER.SCP database", () => {
    const total = scpCount();
    expect(total).toBeGreaterThan(40000);
  });

  it("should find matches for partial callsign 'F4I'", () => {
    const results = scpSearch("F4I", 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.includes("F4I"))).toBe(true);
  });

  it("should find F4IVV in the database", () => {
    const results = scpSearch("F4IVV", 5);
    expect(results).toContain("F4IVV");
  });
});
