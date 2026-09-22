/**
 * RotorWidget — Widget rotor compact dans la barre du haut.
 *
 * Affiche une mini-boussole SVG animée avec l'azimut en temps réel.
 * Au clic, ouvre un panneau avec :
 *   - Boussole graphique grande avec aiguille animée
 *   - 8 boutons de direction rapide disposés en cercle (N/NE/E/SE/S/SO/O/NO)
 *   - Azimut numérique au centre
 *   - Bouton STOP
 */
import { cn } from "@/lib/utils";
import { useRotor } from "@/hooks/useRotor";
import { Square } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

const DIRECTIONS = [
  { label: "N", az: 0, angle: -90 },
  { label: "NE", az: 45, angle: -45 },
  { label: "E", az: 90, angle: 0 },
  { label: "SE", az: 135, angle: 45 },
  { label: "S", az: 180, angle: 90 },
  { label: "SO", az: 225, angle: 135 },
  { label: "O", az: 270, angle: 180 },
  { label: "NO", az: 315, angle: -135 },
];

/** Mini-boussole SVG pour la barre du haut (28×28 px) */
function MiniCompass({
  azimuth,
  connected,
  reachable,
}: {
  azimuth: number;
  connected: boolean;
  reachable: boolean;
}) {
  const needleColor = connected ? "#22d3ee" : reachable ? "#fbbf24" : "#6b7280";
  // Aiguille : pointe vers le nord (haut) = 0°, tourne dans le sens horaire
  const rad = (azimuth - 90) * (Math.PI / 180);
  const cx = 14,
    cy = 14,
    r = 9;
  const tipX = cx + r * Math.cos(rad);
  const tipY = cy + r * Math.sin(rad);
  const tailX = cx - r * 0.55 * Math.cos(rad);
  const tailY = cy - r * 0.55 * Math.sin(rad);

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      {/* Cercle de fond */}
      <circle
        cx="14"
        cy="14"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      {/* Graduations cardinales */}
      {[0, 90, 180, 270].map(a => {
        const ar = (a - 90) * (Math.PI / 180);
        return (
          <line
            key={a}
            x1={14 + 9 * Math.cos(ar)}
            y1={14 + 9 * Math.sin(ar)}
            x2={14 + 11.5 * Math.cos(ar)}
            y2={14 + 11.5 * Math.sin(ar)}
            stroke={a === 0 ? needleColor : "currentColor"}
            strokeOpacity={a === 0 ? 0.9 : 0.3}
            strokeWidth={a === 0 ? 1.5 : 0.8}
          />
        );
      })}
      {/* Aiguille */}
      <line
        x1={tailX}
        y1={tailY}
        x2={tipX}
        y2={tipY}
        stroke={needleColor}
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          transition: "x1 0.5s ease, y1 0.5s ease, x2 0.5s ease, y2 0.5s ease",
        }}
      />
      {/* Point central */}
      <circle cx="14" cy="14" r="2" fill={needleColor} />
    </svg>
  );
}

/** Grande boussole SVG pour le panneau (120×120 px) */
function BigCompass({
  azimuth,
  connected,
  reachable,
}: {
  azimuth: number;
  connected: boolean;
  reachable: boolean;
}) {
  const needleColor = connected ? "#22d3ee" : reachable ? "#fbbf24" : "#6b7280";
  const rad = (azimuth - 90) * (Math.PI / 180);
  const cx = 60,
    cy = 60,
    r = 44;
  const tipX = cx + r * Math.cos(rad);
  const tipY = cy + r * Math.sin(rad);
  const tailX = cx - r * 0.45 * Math.cos(rad);
  const tailY = cy - r * 0.45 * Math.sin(rad);

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      {/* Cercle extérieur */}
      <circle
        cx="60"
        cy="60"
        r="56"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth="1.5"
      />
      {/* Cercle intérieur */}
      <circle
        cx="60"
        cy="60"
        r="44"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
      {/* Graduations tous les 30° */}
      {Array.from({ length: 12 }, (_, i) => i * 30).map(a => {
        const ar = (a - 90) * (Math.PI / 180);
        const isCardinal = a % 90 === 0;
        return (
          <line
            key={a}
            x1={60 + 44 * Math.cos(ar)}
            y1={60 + 44 * Math.sin(ar)}
            x2={60 + (isCardinal ? 52 : 49) * Math.cos(ar)}
            y2={60 + (isCardinal ? 52 : 49) * Math.sin(ar)}
            stroke={a === 0 ? needleColor : "currentColor"}
            strokeOpacity={a === 0 ? 1 : isCardinal ? 0.4 : 0.2}
            strokeWidth={isCardinal ? 1.5 : 0.8}
          />
        );
      })}
      {/* Labels cardinaux */}
      {[
        { label: "N", a: 0, x: 60, y: 8 },
        { label: "E", a: 90, x: 113, y: 63 },
        { label: "S", a: 180, x: 60, y: 116 },
        { label: "O", a: 270, x: 7, y: 63 },
      ].map(({ label, x, y }) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          fill={label === "N" ? needleColor : "currentColor"}
          fillOpacity={label === "N" ? 1 : 0.5}
        >
          {label}
        </text>
      ))}
      {/* Aiguille — queue */}
      <line
        x1={tailX}
        y1={tailY}
        x2={cx}
        y2={cy}
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: "x1 0.6s ease, y1 0.6s ease" }}
      />
      {/* Aiguille — pointe */}
      <line
        x1={cx}
        y1={cy}
        x2={tipX}
        y2={tipY}
        stroke={needleColor}
        strokeWidth="3"
        strokeLinecap="round"
        style={{ transition: "x2 0.6s ease, y2 0.6s ease" }}
      />
      {/* Point central */}
      <circle cx="60" cy="60" r="4" fill={needleColor} />
      <circle cx="60" cy="60" r="2" fill="var(--background)" />
    </svg>
  );
}

export function RotorWidget() {
  const {
    azimuth,
    targetAzimuth,
    connected,
    reachable,
    bridgeAlive,
    station,
    controller,
    operationMode,
    motionAllowed,
    localControl,
    moving,
    errorMessage,
    goTo,
    stop,
    isPending,
  } = useRotor();
  const [open, setOpen] = useState(false);
  const [manualAz, setManualAz] = useState("");
  const movementBlockedReason = localControl
    ? "Priorité au pupitre ARCO local"
    : operationMode === "monitor"
      ? "Lecture seule active"
      : !connected
        ? "Bridge ARCO non connecté"
        : "Mouvement non autorisé";

  const handleGoTo = (az: number, label: string) => {
    if (!goTo(az)) {
      toast.error("Mouvement rotor bloqué", {
        description: movementBlockedReason,
      });
      return;
    }
    toast.success(`Rotor → ${label} (${az}°)`, { icon: "🧭" });
    setOpen(false);
  };

  const handleStop = () => {
    stop();
    toast.info("Rotor STOP");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer active:scale-[0.97]",
            connected
              ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:border-cyan-400/70"
              : reachable
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-amber-400/60"
                : "border-border/50 bg-card/30 text-muted-foreground/50 hover:border-border"
          )}
          title={`${station} · ${controller} — ${motionAllowed ? "mouvement autorisé" : movementBlockedReason} · Azimut : ${azimuth}°`}
        >
          <MiniCompass
            azimuth={azimuth}
            connected={connected}
            reachable={reachable}
          />
          <span className="tabular-nums">{azimuth}°</span>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected
                ? "bg-cyan-400 animate-pulse"
                : reachable
                  ? "bg-amber-400"
                  : "bg-muted-foreground/30"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          {/* En-tête */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-sm font-bold text-foreground">
                {station} · ARCO
              </span>
              <div className="font-mono text-[9px] text-muted-foreground">
                {controller}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  connected
                    ? "bg-cyan-400 animate-pulse"
                    : reachable
                      ? "bg-amber-400"
                      : "bg-muted-foreground/30"
                )}
              />
              <span
                className={cn(
                  "font-mono text-[10px]",
                  connected
                    ? "text-cyan-400"
                    : reachable
                      ? "text-amber-400"
                      : "text-muted-foreground/50"
                )}
              >
                {connected
                  ? moving
                    ? "En mouvement"
                    : "Connecté"
                  : reachable
                    ? "Bridge en attente"
                    : "Hors ligne"}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "rounded border px-2.5 py-2 font-mono text-[10px]",
              motionAllowed
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-cyan-500/30 bg-cyan-500/5 text-cyan-300"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                {motionAllowed ? "Pilotage explicite" : "Lecture seule"}
              </span>
              <span>
                {localControl
                  ? "Pupitre local prioritaire"
                  : motionAllowed
                    ? "Mouvement autorisé"
                    : movementBlockedReason}
              </span>
            </div>
            {targetAzimuth !== null && (
              <div className="mt-1 text-muted-foreground">
                Cible confirmée : {targetAzimuth}°
              </div>
            )}
            {errorMessage && (
              <div className="mt-1 text-destructive">{errorMessage}</div>
            )}
          </div>

          {/* Boussole + azimut + boutons en cercle */}
          <div className="relative flex items-center justify-center">
            {/* Boussole centrale */}
            <div
              className={cn("transition-opacity", isPending && "opacity-60")}
            >
              <BigCompass
                azimuth={azimuth}
                connected={connected}
                reachable={reachable}
              />
            </div>
            {/* Azimut au centre */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-lg font-extrabold tabular-nums text-cyan-400 leading-none">
                {azimuth}°
              </span>
            </div>
            {/* Boutons 8 directions positionnés en cercle autour de la boussole */}
            {DIRECTIONS.map(({ label, az, angle }) => {
              const rad = angle * (Math.PI / 180);
              // Rayon du cercle de boutons (en px, depuis le centre 60,60 de la boussole 120px)
              const R = 78;
              const bx = 60 + R * Math.cos(rad); // position relative au centre SVG
              const by = 60 + R * Math.sin(rad);
              // Convertir en % par rapport au conteneur 120px
              return (
                <button
                  key={label}
                  onClick={() => handleGoTo(az, label)}
                  disabled={
                    isPending || !motionAllowed || localControl || !connected
                  }
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${bx - 60}px - 14px)`,
                    top: `calc(50% + ${by - 60}px - 14px)`,
                    width: "28px",
                    height: "28px",
                  }}
                  className={cn(
                    "flex items-center justify-center rounded-full border font-mono text-[9px] font-bold uppercase transition-all active:scale-[0.90]",
                    "border-cyan-500/40 bg-background text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/70 shadow-sm",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                  title={`${label} — ${az}°`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Saisie manuelle des degrés */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={360}
              placeholder="0–360°"
              value={manualAz}
              onChange={e => setManualAz(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const v = parseInt(manualAz, 10);
                  if (!isNaN(v) && v >= 0 && v <= 360) {
                    handleGoTo(v % 360, `${v}°`);
                    setManualAz("");
                  }
                }
              }}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-cyan-500/60 focus:outline-none"
            />
            <button
              onClick={() => {
                const v = parseInt(manualAz, 10);
                if (!isNaN(v) && v >= 0 && v <= 360) {
                  handleGoTo(v % 360, `${v}°`);
                  setManualAz("");
                }
              }}
              disabled={
                isPending ||
                !manualAz ||
                !motionAllowed ||
                localControl ||
                !connected
              }
              className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              GO
            </button>
          </div>

          {/* Bouton STOP */}
          <button
            onClick={handleStop}
            disabled={isPending || !bridgeAlive}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-3 py-1.5 font-mono text-xs font-bold text-destructive transition-all hover:bg-destructive/20 active:scale-[0.97] disabled:opacity-40"
          >
            <Square className="h-3 w-3" />
            STOP
          </button>

          <p className="text-center font-mono text-[9px] text-muted-foreground/60">
            La position provient du bridge local Maison. Aucun mouvement
            automatique n’est exécuté.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
