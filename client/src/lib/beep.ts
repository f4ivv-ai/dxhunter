/** Génère un bip d'alerte (style radar) via l'API Web Audio, sans fichier externe. */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/**
 * Bip court. `kind` : "ssb" (deux tons aigus) ou "rare" (séquence d'alerte).
 */
export function playBeep(kind: "ssb" | "rare" | "mult" = "ssb") {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume();

  const now = ac.currentTime;
  const tones = kind === "rare" ? [880, 1320, 1760] : kind === "mult" ? [660, 990, 1320, 1650] : [1175, 1568];

  tones.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.12);
  });
}

/** Doit être appelé sur une interaction utilisateur pour débloquer l'audio. */
export function unlockAudio() {
  const ac = getCtx();
  if (ac && ac.state === "suspended") ac.resume();
}
