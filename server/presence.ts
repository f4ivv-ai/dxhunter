/**
 * Presence tracking — compteur de visiteurs connectés en temps réel.
 * 
 * Chaque client envoie un "ping" toutes les 30 secondes.
 * Le serveur maintient un Map<sessionId, lastSeen>.
 * Les sessions expirées (> 60s sans ping) sont nettoyées périodiquement.
 */

const EXPIRY_MS = 60_000; // 60 secondes sans ping = déconnecté
const CLEANUP_INTERVAL_MS = 15_000; // nettoyage toutes les 15s

// Map de sessionId → timestamp du dernier ping
const sessions = new Map<string, number>();

// Nettoyage périodique des sessions expirées
setInterval(() => {
  const now = Date.now();
  for (const [id, lastSeen] of sessions) {
    if (now - lastSeen > EXPIRY_MS) {
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Enregistre un ping de présence pour un sessionId donné.
 * Retourne le nombre total de sessions actives.
 */
export function presencePing(sessionId: string): number {
  sessions.set(sessionId, Date.now());
  return sessions.size;
}

/**
 * Retourne le nombre de sessions actives.
 */
export function getPresenceCount(): number {
  // Nettoyer les expirées avant de compter
  const now = Date.now();
  for (const [id, lastSeen] of sessions) {
    if (now - lastSeen > EXPIRY_MS) {
      sessions.delete(id);
    }
  }
  return sessions.size;
}
