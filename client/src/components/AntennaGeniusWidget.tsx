/**
 * AntennaGeniusWidget — Widget de commutation d'antennes 4O3A Antenna Genius.
 *
 * Affiche les ports d'antennes disponibles avec leur nom,
 * le port actif en surbrillance, et un toggle auto-band.
 */
import { useAntennaGenius } from "@/hooks/useAntennaGenius";
import { cn } from "@/lib/utils";
import { Antenna, Wifi, WifiOff, ToggleLeft, ToggleRight } from "lucide-react";

export function AntennaGeniusWidget() {
  const {
    connected, bridgeAlive,
    selectedPort, portCount, portNames,
    autoBand,
    selectPort, toggleAutoBand,
    isPending,
  } = useAntennaGenius();

  if (!bridgeAlive) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="font-medium">Antenna Genius non connecté</p>
        <p className="text-xs mt-1">Le bridge doit relayer la connexion TCP vers le port 9007.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {/* ─── Status ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")} />
          <span className="text-xs font-medium">
            {connected ? "Antenna Genius" : "Déconnecté"}
          </span>
        </div>
        <Wifi className={cn("h-3.5 w-3.5", connected ? "text-emerald-400" : "text-muted-foreground/30")} />
      </div>

      {/* ─── Port Grid ─── */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ports antennes
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: portCount }, (_, i) => i + 1).map((port) => {
            const isActive = port === selectedPort;
            const name = portNames[port - 1] || `Port ${port}`;
            return (
              <button
                key={port}
                onClick={() => selectPort(port)}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
                  isActive
                    ? "bg-primary/15 border-primary text-primary shadow-sm"
                    : "bg-muted/30 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <Antenna className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/50")} />
                <div className="min-w-0">
                  <div className={cn("text-xs font-bold truncate", isActive && "text-primary")}>{name}</div>
                  <div className="text-[9px] text-muted-foreground">Port {port}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Auto-Band Toggle ─── */}
      <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
        <div>
          <span className="text-xs font-medium">Auto-Band</span>
          <p className="text-[10px] text-muted-foreground">Commute l'antenne selon la bande</p>
        </div>
        <button
          onClick={() => toggleAutoBand(!autoBand)}
          className="transition-all"
        >
          {autoBand ? (
            <ToggleRight className="h-6 w-6 text-primary" />
          ) : (
            <ToggleLeft className="h-6 w-6 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
