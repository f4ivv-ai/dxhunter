/**
 * SpotDetail — panneau d'expansion sous un spot cliqué.
 * V8.7 : Ajout bouton QSY FlexRadio via CAT Bridge.
 */
import { trpc } from "@/lib/trpc";
import { Spot, fmtFreq, displayMode } from "@/lib/dx";
import { ExternalLink, Headphones, Star, Trash2, Loader2, X, Map, Navigation, Compass, Radio, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryToFlag, getContinent, CONTINENT_SHORT } from "@shared/countryMeta";
import { useVisitorId } from "@/hooks/useVisitorId";
import { toast } from "sonner";
import { bearingDistance, azToCardinal, getUserQTH } from "@/lib/propagation";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo, useState } from "react";
import { useFlexCat } from "@/hooks/useFlexCat";
import { buildPrimaryKiwiTuneUrl } from "@shared/primaryKiwi";

interface Props {
  spot: Spot;
  onClose: () => void;
}

export function SpotDetail({ spot, onClose }: Props) {
  const visitorId = useVisitorId();
  const { user } = useAuth();
  const { bridgeConnected, radioConnected, qsy, split, so2r, qsyMulti, swapAndQsy } = useFlexCat({ autoConnect: true });
  const [splitMode, setSplitMode] = useState(false);
  const [splitOffset, setSplitOffset] = useState(5); // kHz offset par défaut

  const distAz = useMemo(() => {
    const qth = getUserQTH(user?.locator);
    if (spot.dx_latitude == null || spot.dx_longitude == null) return null;
    const { bearing, distance } = bearingDistance(qth.lat, qth.lon, spot.dx_latitude, spot.dx_longitude);
    return { bearing: Math.round(bearing), distance: Math.round(distance), cardinal: azToCardinal(bearing) };
  }, [user?.locator, spot.dx_latitude, spot.dx_longitude]);

  const { data, isLoading, refetch } = trpc.websdr.bestForDx.useQuery(
    {
      dxCall: spot.dx_call,
      freqKhz: spot.freqKhz,
      mode: spot.mode ?? undefined,
      dxLat: spot.dx_latitude ?? undefined,
      dxLon: spot.dx_longitude ?? undefined,
      visitorId,
      maxResults: 6,
    },
    { staleTime: 60_000 }
  );

  const addFavMut = trpc.websdr.addFavorite.useMutation({
    onSuccess: () => refetch(),
  });
  const removeFavMut = trpc.websdr.removeFavorite.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteSdrMut = trpc.websdr.deleteSdr.useMutation({
    onSuccess: (_, vars) => {
      toast(`${vars.sdrName} supprimé`, { description: "Ce WebSDR ne réapparaîtra plus." });
      refetch();
    },
  });

  const toggleFavorite = (sdr: { name: string; url: string; lat: number; lon: number; isFavorite: boolean }) => {
    if (sdr.isFavorite) {
      removeFavMut.mutate({ visitorId, sdrName: sdr.name });
    } else {
      addFavMut.mutate({ visitorId, sdrName: sdr.name, sdrUrl: sdr.url, lat: sdr.lat, lon: sdr.lon });
    }
  };

  const handleDelete = (sdr: { name: string; url: string }) => {
    deleteSdrMut.mutate({ visitorId, sdrName: sdr.name, sdrUrl: sdr.url });
  };

  /** QSY — envoyer la fréquence et le mode au FlexRadio (SO2R-aware) */
  const handleQsy = () => {
    const freqMHz = spot.freqKhz / 1000;
    const mode = spot.mode || spot.family || undefined;
    if (so2r.enabled) {
      const sent = qsyMulti(freqMHz, mode);
      if (sent) {
        toast.success(`QSY MULTI → ${fmtFreq(spot.freqKhz)}`, {
          description: `Mode: ${mode || "auto"} — envoyé au poste MULTI`,
          icon: <Radio className="h-4 w-4" />,
        });
      } else {
        toast.error("CAT Bridge non connecté");
      }
    } else {
      const sent = qsy(freqMHz, mode);
      if (sent) {
        toast.success(`QSY → ${fmtFreq(spot.freqKhz)}`, {
          description: `Mode: ${mode || "auto"} — envoyé au FlexRadio`,
          icon: <Radio className="h-4 w-4" />,
        });
      } else {
        toast.error("CAT Bridge non connecté", {
          description: "Lancez le bridge : cd ~/dxhunter-bridge && node bridge-relay-v7.mjs",
        });
      }
    }
  };

  /** SWAP + QSY — QSY MULTI puis inverse les rôles (double-clic) */
  const handleSwapAndQsy = () => {
    const freqMHz = spot.freqKhz / 1000;
    const mode = spot.mode || spot.family || undefined;
    const sent = swapAndQsy(freqMHz, mode);
    if (sent) {
      toast.success(`SWAP+QSY → ${fmtFreq(spot.freqKhz)}`, {
        description: `QSY MULTI + SWAP — vous êtes maintenant RUN sur cette fréquence`,
        icon: <Radio className="h-4 w-4" />,
      });
    }
  };

  const cleanCall = spot.dx_call.replace(/\/.*$/, "").replace(/^.*\//, "");
  const qrzUrl = `https://www.qrz.com/db/${encodeURIComponent(cleanCall)}`;
  const primaryKiwiUrl = buildPrimaryKiwiTuneUrl(
    spot.freqKhz,
    spot.mode || spot.family || undefined,
  );

  return (
    <tr className="border-b border-primary/30 bg-[oklch(0.14_0.012_250)]">
      <td colSpan={8} className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* En-tête */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm font-bold text-primary">{spot.dx_call}</span>
              <span className="text-xs text-muted-foreground">
                {fmtFreq(spot.freqKhz)} · {spot.family === "SSB" ? displayMode(spot.mode, spot.freqKhz) : (spot.mode || spot.family)}
              </span>
              {spot.dx_country && (
                <span className="text-xs text-foreground/70">
                  {spot.dx_flag} {spot.dx_country}
                </span>
              )}
            </div>

            {/* Distance & Azimut */}
            {distAz && (
              <div className="flex items-center gap-3 mb-2 rounded border border-border/50 bg-card/50 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-mono text-xs font-bold text-foreground">{distAz.distance.toLocaleString()} km</span>
                </div>
                <div className="flex items-center gap-1">
                  <Navigation className="h-3.5 w-3.5 text-primary" style={{ transform: `rotate(${distAz.bearing}deg)` }} />
                  <span className="font-mono text-xs font-bold text-primary">{distAz.bearing}°</span>
                  <span className="text-xs text-muted-foreground">({distAz.cardinal})</span>
                </div>
              </div>
            )}

            {/* Liens rapides + QSY */}
            <div className="flex flex-wrap gap-2 mb-3">
              {user?.role === "admin" && (
                <>
                  {/* Bouton QSY FlexRadio */}
                  <button
                onClick={handleQsy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-[0.97]",
                  bridgeConnected && radioConnected
                    ? "border-green-500/50 bg-green-500/15 text-green-300 hover:border-green-400/70 hover:bg-green-500/25"
                    : "border-orange-500/30 bg-orange-500/10 text-orange-300/70 hover:border-orange-400/50 hover:bg-orange-500/15"
                )}
                title={
                  bridgeConnected && radioConnected
                    ? "Envoyer la fréquence au FlexRadio"
                    : "CAT Bridge non connecté — cliquez pour réessayer"
                }
              >
                <Radio className="h-3.5 w-3.5" />
                QSY
                {bridgeConnected && radioConnected && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
                  </button>

                  {/* Bouton SWAP+QSY (SO2R uniquement) */}
                  {so2r.enabled && bridgeConnected && radioConnected && (
                    <button
                  onClick={handleSwapAndQsy}
                  className="inline-flex items-center gap-1.5 rounded border border-purple-500/50 bg-purple-500/15 px-2.5 py-1.5 text-xs font-bold text-purple-300 transition-all hover:border-purple-400/70 hover:bg-purple-500/25 active:scale-[0.97]"
                  title="QSY MULTI + SWAP — basculer sur cette fréquence en RUN"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  SWAP+QSY
                    </button>
                  )}

                  {/* Bouton Split */}
                  <button
                onClick={() => {
                  if (!bridgeConnected || !radioConnected) {
                    toast.error("CAT Bridge non connecté", { description: "Lancez le bridge : cd ~/dxhunter-bridge && node bridge-relay-v7.mjs" });
                    return;
                  }
                  if (splitMode) {
                    // Désactiver le split : QSY normal
                    setSplitMode(false);
                    handleQsy();
                    toast.info("Split désactivé", { description: "TX et RX sur la même fréquence" });
                  } else {
                    // Activer le split : TX offset
                    const rxFreqMHz = spot.freqKhz / 1000;
                    const txFreqMHz = rxFreqMHz + (splitOffset / 1000);
                    const mode = spot.mode || spot.family || undefined;
                    const sent = split(rxFreqMHz, txFreqMHz, mode);
                    if (sent) {
                      setSplitMode(true);
                      toast.success(`SPLIT activé`, {
                        description: `RX: ${rxFreqMHz.toFixed(3)} / TX: ${txFreqMHz.toFixed(3)} MHz (+${splitOffset} kHz)`,
                        icon: <ArrowLeftRight className="h-4 w-4" />,
                      });
                    }
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-[0.97]",
                  splitMode
                    ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                    : bridgeConnected && radioConnected
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:border-blue-400/60 hover:bg-blue-500/15"
                      : "border-border/40 bg-card/30 text-muted-foreground/50"
                )}
                title={splitMode ? "Désactiver le Split" : `Activer Split TX +${splitOffset} kHz`}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {splitMode ? "SPLIT ON" : "Split"}
                  </button>

                  {/* Split offset selector */}
                  {bridgeConnected && radioConnected && (
                    <select
                  value={splitOffset}
                  onChange={(e) => setSplitOffset(Number(e.target.value))}
                  className="rounded border border-border bg-card px-1.5 py-1.5 text-[10px] font-mono text-foreground/80 focus:border-primary/50 focus:outline-none"
                  title="Offset Split (kHz)"
                >
                  <option value={1}>+1 kHz</option>
                  <option value={2}>+2 kHz</option>
                  <option value={5}>+5 kHz</option>
                  <option value={10}>+10 kHz</option>
                  <option value={-5}>-5 kHz</option>
                  <option value={-10}>-10 kHz</option>
                    </select>
                  )}
                </>
              )}

              <a
                href={qrzUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground/90 transition-all hover:border-primary/50 hover:text-primary active:scale-[0.97]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                QRZ.com
              </a>
              <a
                href={`http://rx.linkfanel.net/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:border-cyan-400/70 hover:bg-cyan-500/20 active:scale-[0.97]"
              >
                <Map className="h-3.5 w-3.5" />
                Carte KiwiSDR
              </a>
              <a
                href={primaryKiwiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-amber-400/50 bg-amber-400/15 px-2.5 py-1.5 text-xs font-black text-amber-200 transition-all hover:border-amber-300/80 hover:bg-amber-400/25 active:scale-[0.97]"
                title={`Écouter immédiatement ${fmtFreq(spot.freqKhz)} sur le KiwiSDR F4IVV de Marcilloles`}
              >
                <Headphones className="h-3.5 w-3.5" />
                Mon Kiwi F4IVV
              </a>
            </div>

            {/* WebSDR intelligents */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-1.5">
                <Headphones className="h-3.5 w-3.5 text-primary" />
                Écouter via WebSDR (sélection intelligente)
              </h4>
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recherche des meilleurs récepteurs…
                </div>
              ) : data?.sdrs && data.sdrs.length > 0 ? (
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {data.sdrs.map((sdr, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 rounded border px-2.5 py-2",
                        "text-xs transition-all",
                        sdr.isFavorite
                          ? "border-yellow-500/40 bg-yellow-500/10"
                          : "border-border/70 bg-card/50 hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      {/* Bouton favori */}
                      <button
                        onClick={() => toggleFavorite(sdr)}
                        className={cn(
                          "shrink-0 transition-all active:scale-[0.9]",
                          sdr.isFavorite ? "text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400/60"
                        )}
                        title={sdr.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Star className="h-3.5 w-3.5" fill={sdr.isFavorite ? "currentColor" : "none"} />
                      </button>

                      {/* Drapeau */}
                      <span className="shrink-0 text-base leading-none" title={sdr.country}>
                        {countryToFlag(sdr.country)}
                      </span>

                      {/* Infos */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate font-medium text-foreground/90">
                          {sdr.city}, {sdr.country}
                          <span className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[8px] font-bold text-primary">
                            {CONTINENT_SHORT[getContinent(sdr.country)]}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {sdr.distanceKm} km · {sdr.type}
                        </div>
                      </div>

                      {/* Bouton supprimer */}
                      <button
                        onClick={() => handleDelete(sdr)}
                        className="shrink-0 text-muted-foreground/20 hover:text-red-400 transition-all active:scale-[0.9]"
                        title="Supprimer ce WebSDR"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>

                      {/* Lien écouter */}
                      <a
                        href={sdr.tuneUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                        title="Écouter"
                      >
                        <ExternalLink className="h-3 w-3 text-primary/70 hover:text-primary" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  Aucun récepteur trouvé à proximité de ce DX.
                </p>
              )}
            </div>
          </div>

          {/* Bouton fermer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
