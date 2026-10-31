import { describe, expect, it } from "vitest";
import { passwordMatches, safeNextPath, MIN_ADMIN_PASSWORD_LENGTH } from "./_core/oauth";
import { msUntilNext } from "./scheduled";
import { withServerUrl, DOWNLOADABLE_FILES } from "./downloads";
import { rotorUiUrl } from "./routers/rotorRelay";

describe("connexion admin locale", () => {
  const good = "un-mot-de-passe-solide";
  it("accepte le bon mot de passe", () => {
    expect(passwordMatches(good, good)).toBe(true);
  });
  it("refuse un mauvais mot de passe", () => {
    expect(passwordMatches("autre-chose-longue", good)).toBe(false);
  });
  it("refuse tout si ADMIN_PASSWORD est absent ou trop court", () => {
    expect(passwordMatches("", "")).toBe(false);
    const short = "x".repeat(MIN_ADMIN_PASSWORD_LENGTH - 1);
    expect(passwordMatches(short, short)).toBe(false);
  });
  it("n'autorise que des redirections internes", () => {
    expect(safeNextPath("/pilot")).toBe("/pilot");
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath("/\\evil")).toBe("/app");
    expect(safeNextPath(undefined)).toBe("/app");
  });
});

describe("planificateur intégré", () => {
  const Q = 15 * 60_000;
  it("vise le prochain quart d'heure", () => {
    const t = Date.UTC(2026, 9, 31, 10, 7, 0);
    expect(msUntilNext(Q, 0, t)).toBe(8 * 60_000);
  });
  it("vise 12:00 UTC pour la calibration", () => {
    const day = 24 * 3600_000;
    const t = Date.UTC(2026, 9, 31, 11, 0, 0);
    expect(msUntilNext(day, 12 * 3600_000, t)).toBe(3600_000);
    const after = Date.UTC(2026, 9, 31, 13, 0, 0);
    expect(msUntilNext(day, 12 * 3600_000, after)).toBe(23 * 3600_000);
  });
});

describe("téléchargement des bridges", () => {
  it("injecte l'adresse du site", () => {
    const src = 'const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";';
    expect(withServerUrl(src, "https://dx.exemple.fr")).toContain('"https://dx.exemple.fr"');
  });
  it("liste blanche sans chemin", () => {
    for (const f of DOWNLOADABLE_FILES) expect(f).not.toMatch(/[\\/]/);
  });
});

describe("rotor configurable", () => {
  it("déduit l'interface de l'URL d'API", () => {
    expect(rotorUiUrl("https://rotor.exemple.fr/api/trpc")).toBe("https://rotor.exemple.fr");
    expect(rotorUiUrl("")).toBeNull();
  });
});
