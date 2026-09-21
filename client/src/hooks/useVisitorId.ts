/**
 * useVisitorId — Identifiant stable du visiteur pour les favoris WebSDR.
 *
 * Si l'utilisateur est connecté (Manus OAuth), on utilise son openId.
 * Sinon, on génère un UUID v4 stocké en localStorage.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const VISITOR_KEY = "dxhunter-visitor-id";

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function useVisitorId(): string {
  const { user } = useAuth();
  const [localId] = useState(getOrCreateVisitorId);

  // If user is authenticated, use their openId for consistency
  return user?.openId ?? localId;
}
