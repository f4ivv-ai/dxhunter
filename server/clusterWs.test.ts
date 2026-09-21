/**
 * Tests pour le module WebSocket DX Cluster (clusterWs.ts)
 */
import { describe, it, expect } from "vitest";
import { _testFormatClusterLine } from "./clusterWs";

describe("clusterWs — formatClusterLine", () => {
  it("formate un spot Spothole (freq en Hz) correctement", () => {
    const spot = {
      id: "spot-123",
      dx_call: "TM0HQ",
      de_call: "F5ABC",
      freq: 14195000, // Hz
      band: "20m",
      comment: "cq cq cq 5/9",
      time: 1720699440, // epoch seconds
      received_time: 1720699440,
      source: "Cluster",
    };

    const line = _testFormatClusterLine(spot);

    // Doit contenir les éléments clés
    expect(line).toContain("DX de F5ABC:");
    expect(line).toContain("14195.0");
    expect(line).toContain("TM0HQ");
    expect(line).toContain("cq cq cq 5/9");
    expect(line.endsWith("\r\n")).toBe(true);
    // Doit contenir un timestamp HHMMZ
    expect(line).toMatch(/\d{4}Z/);
  });

  it("formate un spot DX Summit (freq déjà en kHz via *1000) correctement", () => {
    const spot = {
      id: "dxs-456",
      dx_call: "JA1ABC",
      de_call: "DL2XYZ",
      freq: 21250000, // Hz (21250 kHz * 1000)
      band: "15m",
      comment: "tnx 59",
      time: 1720700000,
      received_time: 1720700000,
      source: "DXSummit",
    };

    const line = _testFormatClusterLine(spot);

    expect(line).toContain("DX de DL2XYZ:");
    expect(line).toContain("21250.0");
    expect(line).toContain("JA1ABC");
    expect(line).toContain("tnx 59");
    expect(line.endsWith("\r\n")).toBe(true);
  });

  it("utilise F-13807 comme spotter par défaut si de_call est vide", () => {
    const spot = {
      id: "spot-789",
      dx_call: "VK2ABC",
      de_call: "",
      freq: 7185000,
      band: "40m",
      comment: "",
      time: 1720700100,
      received_time: 1720700100,
    };

    const line = _testFormatClusterLine(spot);

    expect(line).toContain("DX de F-13807:");
    expect(line).toContain("7185.0");
    expect(line).toContain("VK2ABC");
    // 40m < 10 MHz → LSB
    expect(line).toContain("LSB");
  });

  it("force LSB pour les fréquences < 10 MHz (40m, 80m, 160m)", () => {
    const spot40 = {
      id: "spot-lsb-40",
      dx_call: "DL1ABC",
      de_call: "F5XYZ",
      freq: 7050000,
      band: "40m",
      mode: "USB", // erreur dans la source
      comment: "cq",
      time: 1720700100,
      received_time: 1720700100,
    };
    const line40 = _testFormatClusterLine(spot40);
    expect(line40).toContain("LSB");
    expect(line40).not.toContain("USB");

    const spot80 = {
      id: "spot-lsb-80",
      dx_call: "G3ABC",
      de_call: "F5XYZ",
      freq: 3750000,
      band: "80m",
      comment: "59",
      time: 1720700100,
      received_time: 1720700100,
    };
    const line80 = _testFormatClusterLine(spot80);
    expect(line80).toContain("LSB");
  });

  it("force USB pour les fréquences >= 10 MHz (20m, 15m, 10m)", () => {
    const spot20 = {
      id: "spot-usb-20",
      dx_call: "JA1ABC",
      de_call: "F5XYZ",
      freq: 14250000,
      band: "20m",
      comment: "cq contest",
      time: 1720700100,
      received_time: 1720700100,
    };
    const line20 = _testFormatClusterLine(spot20);
    expect(line20).toContain("USB");
    expect(line20).not.toContain("LSB");
  });

  it("gère une fréquence en kHz (< 100000) correctement", () => {
    const spot = {
      id: "spot-low",
      dx_call: "W1AW",
      de_call: "ON4UN",
      freq: 14195, // déjà en kHz
      band: "20m",
      comment: "test",
      time: 1720700200,
      received_time: 1720700200,
    };

    const line = _testFormatClusterLine(spot);

    expect(line).toContain("14195.0");
    expect(line).toContain("W1AW");
  });

  it("tronque les commentaires longs à 30 caractères", () => {
    const spot = {
      id: "spot-long",
      dx_call: "ZL1ABC",
      de_call: "F6DEF",
      freq: 28500000,
      band: "10m",
      comment: "This is a very long comment that should be truncated to 30 chars",
      time: 1720700300,
      received_time: 1720700300,
    };

    const line = _testFormatClusterLine(spot);

    // Le mode USB est injecté en tête, le tout tronqué à 30 chars
    expect(line).toContain("USB This is a very long commen");
  });

  it("gère un spot sans timestamp (time=0) avec 0000Z", () => {
    const spot = {
      id: "spot-notime",
      dx_call: "PY2ABC",
      de_call: "G3XYZ",
      freq: 3750000,
      band: "80m",
      comment: "qso",
      time: 0,
      received_time: 0,
    };

    const line = _testFormatClusterLine(spot);

    expect(line).toContain("0000Z");
  });

  it("produit un format parsable par Win-Test (structure standard)", () => {
    const spot = {
      id: "spot-wt",
      dx_call: "9A1A",
      de_call: "IK2XYZ",
      freq: 14250000,
      band: "20m",
      comment: "cq contest",
      time: 1720706400, // 12:00 UTC
      received_time: 1720706400,
    };

    const line = _testFormatClusterLine(spot);

    // Format standard : DX de <call>:  <freq>  <dxcall>  <comment>  <time>Z
    expect(line).toMatch(/^DX de \S+:\s+[\d.]+\s+\S+/);
    expect(line).toMatch(/\d{4}Z\r\n$/);
  });
});
