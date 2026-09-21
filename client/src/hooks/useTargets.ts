import { useCallback, useEffect, useState } from "react";
import { parseTargets } from "@/lib/dx";

const STORAGE_KEY = "dxhunter.targets";

/**
 * Gère la liste de cibles ("à chasser") saisie par l'utilisateur,
 * persistée dans le localStorage du navigateur.
 */
export function useTargets() {
  const [raw, setRaw] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const [targets, setTargets] = useState<string[]>(() => parseTargets(raw));

  useEffect(() => {
    setTargets(parseTargets(raw));
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // localStorage indisponible : on ignore silencieusement
    }
  }, [raw]);

  const addTarget = useCallback((value: string) => {
    setRaw((prev) => {
      const v = value.trim();
      if (!v) return prev;
      const existing = parseTargets(prev).map((t) => t.toUpperCase());
      if (existing.includes(v.toUpperCase())) return prev;
      return prev ? `${prev}, ${v}` : v;
    });
  }, []);

  const removeTarget = useCallback((value: string) => {
    setRaw((prev) =>
      parseTargets(prev)
        .filter((t) => t.toUpperCase() !== value.toUpperCase())
        .join(", ")
    );
  }, []);

  const clear = useCallback(() => setRaw(""), []);

  return { raw, setRaw, targets, addTarget, removeTarget, clear };
}
