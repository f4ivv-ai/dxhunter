import { describe, expect, it } from "vitest";
import { shouldShowQsyButton } from "./SpotRow";

describe("SpotRow — visibilité QSY", () => {
  it("garde le bouton présent lorsque le CAT est déconnecté", () => {
    expect(shouldShowQsyButton(() => undefined)).toBe(true);
  });

  it("ne réserve l’emplacement que si une action QSY existe", () => {
    expect(shouldShowQsyButton(undefined)).toBe(false);
  });
});
