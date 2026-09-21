import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { BAND_COLORS } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { Radio, Wifi, WifiOff, MapPin, Globe } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { locatorToLatLon } from "@/lib/propagation";
import { ituZoneFromLatLon } from "@/lib/multipliers";

const CONTEST_BANDS = ["160m", "80m", "40m", "20m", "15m", "10m"] as const;
const CONTINENTS = ["EU", "AS", "NA", "SA", "AF", "OC"] as const;

/** Zones ITU voisines intéressantes pour le contest (affichées en plus de "Ma zone") */
const NEIGHBOR_ZONES: Record<number, { zone: number; label: string }[]> = {
  // Europe de l'Ouest (France etc.)
  27: [
    { zone: 28, label: "28 Sud EU" },
    { zone: 29, label: "29 Est EU" },
    { zone: 18, label: "18 Scand." },
    { zone: 16, label: "16 Russie" },
  ],
  // Europe du Sud
  28: [
    { zone: 27, label: "27 Ouest EU" },
    { zone: 29, label: "29 Est EU" },
    { zone: 18, label: "18 Scand." },
    { zone: 39, label: "39 M-Orient" },
  ],
  // Scandinavie
  18: [
    { zone: 27, label: "27 Ouest EU" },
    { zone: 29, label: "29 Est EU" },
    { zone: 16, label: "16 Russie" },
  ],
  // USA Ouest
  6: [
    { zone: 7, label: "7 USA Centre" },
    { zone: 8, label: "8 USA Est" },
    { zone: 1, label: "1 Alaska" },
    { zone: 3, label: "3 Canada O" },
  ],
  // USA Centre
  7: [
    { zone: 6, label: "6 USA Ouest" },
    { zone: 8, label: "8 USA Est" },
    { zone: 4, label: "4 Canada C" },
  ],
  // USA Est
  8: [
    { zone: 7, label: "7 USA Centre" },
    { zone: 6, label: "6 USA Ouest" },
    { zone: 5, label: "5 Canada E" },
    { zone: 11, label: "11 Caraïbes" },
  ],
  // Alaska
  1: [
    { zone: 6, label: "6 USA Ouest" },
    { zone: 3, label: "3 Canada O" },
    { zone: 2, label: "2 Nord Canada" },
  ],
  // Japon/Corée
  45: [
    { zone: 25, label: "25 Chine E" },
    { zone: 30, label: "30 Asie C" },
    { zone: 54, label: "54 Asie SE" },
  ],
  // Hawaii / Pacifique
  61: [
    { zone: 6, label: "6 USA Ouest" },
    { zone: 1, label: "1 Alaska" },
    { zone: 56, label: "56 Pac. Ouest" },
    { zone: 59, label: "59 Australie" },
  ],
};

/** Noms courts des zones ITU connues */
const ZONE_NAMES: Record<number, string> = {
  1: "Alaska", 2: "Nord Canada", 3: "Canada O", 4: "Canada C", 5: "Canada E",
  6: "USA O", 7: "USA C", 8: "USA E", 9: "Bermudes", 10: "Mexique",
  11: "Caraïbes", 12: "Am. Sud N", 13: "Am. Sud O", 14: "Brésil", 15: "Am. Sud S",
  16: "Terre Feu", 17: "Sibérie O", 18: "Scand.", 19: "Sibérie E", 20: "Açores",
  21: "Groenland", 22: "Atl. C", 23: "Atl. Trop.", 24: "Atl. Sud", 25: "Atl. SE",
  27: "EU Ouest", 28: "EU Est", 29: "Russie EU", 30: "Asie C", 31: "Tibet",
  32: "Chine NE", 33: "Chine E", 34: "Mongolie", 35: "Corée", 36: "Canaries",
  37: "Afr. NO", 38: "Afr. NE", 39: "M-Orient", 40: "Pakistan", 41: "Inde",
  42: "Maldives", 43: "Oc. Indien", 44: "Chine S", 45: "Japon", 46: "Afr. Ouest",
  47: "Afr. CO", 48: "Afr. Est", 49: "Thaïlande", 50: "Birmanie", 51: "Guam",
  52: "Afr. SO", 53: "Afr. SE", 54: "Asie SE", 55: "Australie O", 56: "Mélanésie",
  57: "Afr. Sud", 58: "Fidji", 59: "Australie E", 60: "Nlle-Zélande",
  61: "Hawaii", 62: "Pac. C", 63: "Pac. Sud", 64: "Pac. Est", 65: "Pac. NE",
  66: "Oc. Ind. S", 67: "Oc. Ind. E", 74: "Antarctique", 75: "Arctique",
};

/**
 * Indicateur de propagation FT8 en temps réel via PSK Reporter.
 * Affiche une matrice bande × continent avec le nombre de spots FT8 (SNR > -18 dB).
 * Permet de filtrer par bande ET par zone ITU de réception.
 * La zone "Ma zone" est calculée dynamiquement à partir du locator de l'utilisateur.
 */
export function FT8Propagation() {
  const { user } = useAuth();

  // Calcul dynamique de la zone ITU de l'utilisateur à partir de son locator
  const userZone = useMemo(() => {
    const loc = user?.locator;
    if (!loc || loc.length < 4) return 27; // fallback France
    const coords = locatorToLatLon(loc);
    if (!coords) return 27;
    const zone = ituZoneFromLatLon(coords.lat, coords.lon);
    return zone ?? 27;
  }, [user?.locator]);

  const userZoneLabel = useMemo(() => {
    const name = ZONE_NAMES[userZone] || `Zone ${userZone}`;
    return `Ma zone (${userZone} ${name})`;
  }, [userZone]);

  // Zones voisines à afficher
  const neighborZones = useMemo(() => {
    return NEIGHBOR_ZONES[userZone] || [];
  }, [userZone]);

  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [rxItuZone, setRxItuZone] = useState<number | undefined>(userZone);

  // Synchroniser rxItuZone quand userZone change
  useEffect(() => {
    setRxItuZone(userZone);
  }, [userZone]);

  const { data, isLoading } = trpc.spots.ft8Propagation.useQuery(
    rxItuZone ? { rxItuZone } : undefined,
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
        <Radio className="h-3.5 w-3.5 animate-pulse" />
        Connexion PSK Reporter...
      </div>
    );
  }

  if (!data) return null;

  const { bands, connected, lastUpdate, filteredByZone, totalSpotsInWindow, primaryReceiver } = data;

  // Calcul du max global pour l'intensité des cases
  let maxCount = 0;
  for (const band of CONTEST_BANDS) {
    const bandData = bands[band];
    if (!bandData) continue;
    for (const cont of CONTINENTS) {
      const c = bandData.continents[cont];
      if (c && c.count > maxCount) maxCount = c.count;
    }
  }

  // Total filtré
  let filteredTotal = 0;
  for (const band of CONTEST_BANDS) {
    filteredTotal += bands[band]?.total || 0;
  }

  // Bandes à afficher (toutes ou une seule si filtrée)
  const displayBands = selectedBand
    ? CONTEST_BANDS.filter(b => b === selectedBand)
    : CONTEST_BANDS;

  return (
    <div className="space-y-2">
      {/* En-tête avec statut connexion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {connected ? (
            <Wifi className="h-3 w-3 text-emerald-400" />
          ) : (
            <WifiOff className="h-3 w-3 text-amber-400" />
          )}
          <span className="font-mono text-[9px] text-muted-foreground">
            {connected ? "PSK Reporter live" : "Connexion..."}
          </span>
        </div>
        {lastUpdate > 0 && (
          <span className="font-mono text-[9px] text-muted-foreground/60">
            {Math.round((Date.now() - lastUpdate) / 1000)}s
          </span>
        )}
      </div>

      <div className={cn(
        "flex flex-wrap items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px]",
        primaryReceiver.active
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
          : "border-border bg-muted/20 text-muted-foreground",
      )}>
        <Radio className="h-3 w-3" />
        <span className="font-black">KIWI {primaryReceiver.callsign}</span>
        <span>{primaryReceiver.locator}</span>
        <span>· RX {primaryReceiver.rxSpots}</span>
        <span>· TX {primaryReceiver.txSpots}</span>
        <span className="ml-auto">{primaryReceiver.active ? "source locale active" : "secours zone ITU"}</span>
      </div>

      {/* Filtre zone ITU de réception */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/30 pb-1.5">
        <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
        <span className="font-mono text-[9px] text-muted-foreground mr-1">RX :</span>
        <button
          onClick={() => setRxItuZone(undefined)}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all",
            !rxItuZone
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
              : "text-muted-foreground/70 hover:text-foreground"
          )}
          title="Tous les récepteurs (monde entier)"
        >
          <Globe className="h-2.5 w-2.5 inline mr-0.5" />
          MONDE
        </button>
        {/* Ma zone (dynamique) */}
        <button
          onClick={() => setRxItuZone(rxItuZone === userZone ? undefined : userZone)}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all",
            rxItuZone === userZone
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
              : "text-muted-foreground/70 hover:text-foreground"
          )}
          title={`Filtrer par zone ITU ${userZone} (votre zone)`}
        >
          {userZoneLabel}
        </button>
        {/* Zones voisines */}
        {neighborZones.map(z => (
          <button
            key={z.zone}
            onClick={() => setRxItuZone(rxItuZone === z.zone ? undefined : z.zone)}
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all",
              rxItuZone === z.zone
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
                : "text-muted-foreground/70 hover:text-foreground"
            )}
            title={`Filtrer par zone ITU ${z.zone}`}
          >
            {z.label}
          </button>
        ))}
      </div>

      {/* Info filtrage */}
      {filteredByZone && (
        <div className="flex items-center gap-1 font-mono text-[9px]">
          <MapPin className="h-2.5 w-2.5 text-amber-400" />
          <span className="text-amber-400 font-bold">Zone ITU {filteredByZone}</span>
          <span className="text-muted-foreground">
            — {filteredTotal} spots / {totalSpotsInWindow} total
          </span>
        </div>
      )}

      {/* Filtres par bande */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setSelectedBand(null)}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all",
            !selectedBand
              ? "bg-primary/20 text-primary ring-1 ring-primary/50"
              : "text-muted-foreground/70 hover:text-foreground"
          )}
        >
          TOUTES
        </button>
        {CONTEST_BANDS.map(b => {
          const color = BAND_COLORS[b];
          const count = bands[b]?.total || 0;
          return (
            <button
              key={b}
              onClick={() => setSelectedBand(selectedBand === b ? null : b)}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all",
                selectedBand === b
                  ? "ring-1 ring-current"
                  : "opacity-70 hover:opacity-100"
              )}
              style={{ color }}
              title={`${b} : ${count} spots FT8`}
            >
              {b} {count > 0 && <span className="text-[8px]">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Matrice bande × continent */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <th className="px-1 py-1 text-left font-medium">Bd</th>
              {CONTINENTS.map(c => (
                <th key={c} className="px-1 py-1 text-center font-medium">
                  {c}
                </th>
              ))}
              <th className="px-1 py-1 text-right font-medium">Tot</th>
            </tr>
          </thead>
          <tbody>
            {displayBands.map(b => {
              const color = BAND_COLORS[b];
              const bandData = bands[b];
              const total = bandData?.total || 0;
              return (
                <tr key={b}>
                  <td className="px-1 py-0.5">
                    <span
                      className="inline-block rounded px-1 py-0.5 font-mono text-[10px] font-bold"
                      style={{ color, background: `${color}1f` }}
                    >
                      {b}
                    </span>
                  </td>
                  {CONTINENTS.map(cont => {
                    const v = bandData?.continents[cont]?.count || 0;
                    const snr = bandData?.continents[cont]?.avgSnr;
                    const intensity = maxCount > 0 ? v / maxCount : 0;
                    return (
                      <td key={cont} className="px-0.5 py-0.5 text-center">
                        <div
                          className={cn(
                            "mx-auto flex h-6 w-full min-w-[26px] items-center justify-center rounded font-mono text-[10px] font-bold tabular-nums transition-colors",
                            v === 0 && "bg-muted/20 text-muted-foreground/30"
                          )}
                          style={
                            v > 0
                              ? {
                                  background: `${color}${Math.round(25 + intensity * 70)
                                    .toString(16)
                                    .padStart(2, "0")}`,
                                  color: intensity > 0.5 ? "#0a0a0a" : color,
                                }
                              : undefined
                          }
                          title={`${b} → ${cont} : ${v} spots FT8${snr !== undefined ? ` (avg ${snr} dB)` : ""}${filteredByZone ? ` [reçus zone ${filteredByZone}]` : ""}`}
                        >
                          {v > 0 ? v : "·"}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-1 py-0.5 text-right">
                    <span className="font-mono text-[10px] font-bold text-foreground/80 tabular-nums">
                      {total}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <p className="font-mono text-[9px] text-muted-foreground/60">
        FT8 SNR &gt; -18 dB · fenêtre 5 min ·{" "}
        {filteredByZone
          ? `réception zone ITU ${filteredByZone} uniquement`
          : "tous récepteurs monde"
        }
      </p>
    </div>
  );
}
