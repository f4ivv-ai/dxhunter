/**
 * Hook de présence — envoie un ping toutes les 30s et retourne le nombre de connectés.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const PING_INTERVAL_MS = 30_000; // 30 secondes

function getSessionId(): string {
  const KEY = "dx-hunter-session-id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export function usePresence() {
  const [count, setCount] = useState<number>(0);
  const sessionId = useRef(getSessionId());
  const pingMutation = trpc.presence.ping.useMutation();

  useEffect(() => {
    // Ping immédiat au montage
    pingMutation.mutate(
      { sessionId: sessionId.current },
      { onSuccess: (data) => setCount(data.count) }
    );

    // Ping périodique
    const interval = setInterval(() => {
      pingMutation.mutate(
        { sessionId: sessionId.current },
        { onSuccess: (data) => setCount(data.count) }
      );
    }, PING_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return count;
}
