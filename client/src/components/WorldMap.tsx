/**
 * Carte des zones CQ (style EI8IC) — fond image + marqueurs DX interactifs.
 * 
 * - Fond : image des zones CQ (projection équirectangulaire)
 * - Spots DX positionnés par lat/lon
 * - Hover → indicatif (call) visible
 * - Clic → popup avec infos complètes du spot
 */
import { useMemo, useState, useCallback } from "react";
import { Spot, BAND_COLORS, displayMode } from "@/lib/dx";
import { cn } from "@/lib/utils";
import { Maximize2, X, Radio, ExternalLink, Headphones, Star, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useVisitorId } from "@/hooks/useVisitorId";
import { toast } from "sonner";

const CQ_MAP_URL = "/manus-storage/cq-zone-map_2b30e4f3.png";

// Image dimensions (projection équirectangulaire : -180..180 lon, -90..90 lat)
const W = 1000;
const H = 500;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y];
}

interface Props {
  spots: Spot[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelectSpot?: (spot: Spot) => void;
  userLocator?: string;
}

/** Popup d'info spot */
function SpotPopup({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  const bandColor = BAND_COLORS[spot.band || ""] || "#ffb000";
  const visitorId = useVisitorId();
  const [showSdrs, setShowSdrs] = useState(false);
  const { data: sdrData, refetch: refetchSdrs } = trpc.websdr.bestForDx.useQuery(
    {
      dxCall: spot.dx_call,
      freqKhz: spot.freqKhz,
      mode: spot.mode ?? undefined,
      dxLat: spot.dx_latitude ?? undefined,
      dxLon: spot.dx_longitude ?? undefined,
      visitorId,
      maxResults: 6,
    },
    { enabled: !!spot.dx_call }
  );
  const sdrs = sdrData?.sdrs ?? [];
  const addFav = trpc.websdr.addFavorite.useMutation({ onSuccess: () => refetchSdrs() });
  const delSdr = trpc.websdr.deleteSdr.useMutation({ onSuccess: () => refetchSdrs() });
  return (
    <div
      className="absolute z-20 w-64 rounded-lg border border-primary/40 bg-[oklch(0.14_0.01_250)] p-3 shadow-xl"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-extrabold text-foreground">
          {spot.dx_call}
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Fréq:</span>
          <span className="font-bold text-foreground">{spot.freqKhz.toFixed(1)} kHz</span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: bandColor + "30", color: bandColor }}
          >
            {spot.band}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Mode:</span>
          <span className="font-bold text-foreground">{spot.family === "SSB" ? displayMode(spot.mode, spot.freqKhz) : (spot.mode || spot.family)}</span>
        </div>
        {spot.dx_country && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Pays:</span>
            <span className="text-foreground">
              {spot.dx_flag && <span className="mr-1">{spot.dx_flag}</span>}
              {spot.dx_country}
            </span>
          </div>
        )}
        {spot.dx_continent && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Continent:</span>
            <span className="text-foreground">{spot.dx_continent}</span>
          </div>
        )}
        {spot.dx_cq_zone != null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Zone CQ:</span>
            <span className="font-bold text-primary">{spot.dx_cq_zone}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Spotter:</span>
          <span className="text-foreground">{spot.de_call}</span>
          {spot.de_country && <span className="text-muted-foreground/70">({spot.de_country})</span>}
        </div>
        {spot.comment && (
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground shrink-0">Info:</span>
            <span className="text-foreground/80 italic">{spot.comment}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Heure:</span>
          <span className="text-foreground">
            {new Date(spot.received_time * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
          </span>
        </div>
        {spot.isRare && (
          <div className="mt-1 rounded bg-red-500/20 px-2 py-0.5 text-center text-[10px] font-bold text-red-400 uppercase">
            DX Rare
          </div>
        )}
      </div>
      {/* Liens QRZ + WebSDR */}
      <div className="mt-2 flex gap-1.5">
        <a
          href={`https://www.qrz.com/db/${spot.dx_call}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] font-bold text-primary transition-all hover:bg-primary/20"
        >
          <ExternalLink className="h-3 w-3" />
          QRZ.com
        </a>
        <button
          onClick={() => setShowSdrs(!showSdrs)}
          className="flex-1 flex items-center justify-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
        >
          <Headphones className="h-3 w-3" />
          WebSDR ({sdrs.length})
        </button>
      </div>
      {/* Liste des WebSDR */}
      {showSdrs && sdrs.length > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto space-y-1 border-t border-border/50 pt-2">
          {sdrs.map((sdr) => (
            <div key={sdr.tuneUrl} className="flex items-center gap-1 group">
              <a
                href={sdr.tuneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-emerald-500/10 transition-colors"
              >
                <Headphones className="h-3 w-3 shrink-0 text-emerald-400" />
                <span className="truncate font-mono text-[10px] text-foreground">
                  {sdr.name}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                  {sdr.distanceKm} km
                </span>
              </a>
              {/* Favori */}
              <button
                onClick={() => {
                  addFav.mutate(
                    { visitorId, sdrName: sdr.name, sdrUrl: sdr.url, lat: sdr.lat, lon: sdr.lon },
                    { onSuccess: () => toast.success(`${sdr.name} ajouté aux favoris`) }
                  );
                }}
                className={`shrink-0 p-0.5 rounded transition-colors ${
                  sdr.isFavorite ? "text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"
                }`}
              >
                <Star className="h-3 w-3" fill={sdr.isFavorite ? "currentColor" : "none"} />
              </button>
              {/* Supprimer */}
              <button
                onClick={() => {
                  delSdr.mutate(
                    { visitorId, sdrName: sdr.name, sdrUrl: sdr.url },
                    { onSuccess: () => toast.success(`${sdr.name} supprimé`) }
                  );
                }}
                className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MapContent({
  spots,
  hoveredId,
  onHover,
  fullscreen,
  selectedSpot,
  onSelectSpot,
  onDeselectSpot,
  userLocator,
}: Props & {
  fullscreen: boolean;
  selectedSpot: Spot | null;
  onSelectSpot: (s: Spot) => void;
  onDeselectSpot: () => void;
}) {
  const points = useMemo(
    () =>
      spots
        .filter((s) => s.dx_latitude != null && s.dx_longitude != null)
        .slice(0, fullscreen ? 500 : 250)
        .map((s) => {
          const [x, y] = project(s.dx_longitude!, s.dx_latitude!);
          return { s, x, y };
        }),
    [spots, fullscreen]
  );

  // QTH position — dynamique selon le locator de l'utilisateur
  const qthCoords = useMemo(() => {
    if (!userLocator || userLocator.length < 4) return { lat: 45.27, lon: 5.29 };
    const loc = userLocator;
    const A = loc.toUpperCase().charCodeAt(0) - 65;
    const B = loc.toUpperCase().charCodeAt(1) - 65;
    const C = parseInt(loc[2], 10);
    const D = parseInt(loc[3], 10);
    let lon2 = A * 20 + C * 2 - 180;
    let lat2 = B * 10 + D * 1 - 90;
    if (loc.length >= 6) {
      const E = loc.toLowerCase().charCodeAt(4) - 97;
      const F = loc.toLowerCase().charCodeAt(5) - 97;
      lon2 += E * (2 / 24) + (1 / 24);
      lat2 += F * (1 / 24) + (1 / 48);
    } else {
      lon2 += 1; lat2 += 0.5;
    }
    return { lat: lat2, lon: lon2 };
  }, [userLocator]);
  const [qthX, qthY] = project(qthCoords.lon, qthCoords.lat);

  // Position du popup
  const selectedPoint = selectedSpot
    ? points.find((p) => p.s.id === selectedSpot.id)
    : null;

  return (
    <div className="relative w-full" onClick={onDeselectSpot}>
      {/* Image de fond — carte des zones CQ */}
      <img
        src={CQ_MAP_URL}
        alt="Carte des zones CQ"
        className="w-full h-auto block"
        draggable={false}
      />

      {/* Overlay SVG pour les marqueurs */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: "none" }}
      >
        {/* QTH marker */}
        <g>
          <circle
            cx={qthX}
            cy={qthY}
            r={fullscreen ? 6 : 4}
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={fullscreen ? 1.5 : 1}
          />
          {fullscreen && (
            <text
              x={qthX + 8}
              y={qthY + 4}
              fill="#ef4444"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="bold"
              style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2.5 }}
            >
              QTH
            </text>
          )}
        </g>

        {/* Spot markers */}
        <g>
          {points.map(({ s, x, y }) => {
            const color = BAND_COLORS[s.band || ""] || "#ffb000";
            const isHover = hoveredId === s.id;
            const isSelected = selectedSpot?.id === s.id;
            const r = fullscreen
              ? s.isRare ? 5 : isHover || isSelected ? 5 : 3.5
              : s.isRare ? 3.5 : isHover || isSelected ? 3.5 : 2.2;
            return (
              <g
                key={s.id}
                onMouseEnter={() => onHover(s.id)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSpot(s);
                }}
                style={{ cursor: "pointer", pointerEvents: "auto" }}
              >
                {/* Pulse pour rare ou sélectionné */}
                {(s.isRare || isSelected) && (
                  <circle cx={x} cy={y} r={r + 4} fill={color} opacity={0.2}>
                    <animate
                      attributeName="r"
                      values={`${r + 2};${r + 8};${r + 2}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* Point principal */}
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  stroke={isSelected ? "#fff" : isHover ? "#fff" : "rgba(0,0,0,0.5)"}
                  strokeWidth={isSelected ? 2 : isHover ? 1.2 : 0.5}
                />
                {/* Label indicatif au hover */}
                {(isHover || isSelected) && (
                  <text
                    x={x + (fullscreen ? 8 : 5)}
                    y={y - (fullscreen ? 6 : 4)}
                    fill="#fff"
                    fontSize={fullscreen ? "12" : "9"}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 3 }}
                  >
                    {s.dx_call}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Popup d'info au clic */}
      {selectedSpot && selectedPoint && (
        <div
          className="absolute"
          style={{
            left: `${(selectedPoint.x / W) * 100}%`,
            top: `${(selectedPoint.y / H) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <SpotPopup spot={selectedSpot} onClose={onDeselectSpot} />
        </div>
      )}
    </div>
  );
}

export function WorldMap({ spots, hoveredId, onHover, onSelectSpot, userLocator }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

  const handleSelectSpot = useCallback((s: Spot) => {
    setSelectedSpot(s);
    onSelectSpot?.(s);
  }, [onSelectSpot]);

  const handleDeselectSpot = useCallback(() => {
    setSelectedSpot(null);
  }, []);

  return (
    <>
      {/* Carte miniature dans la sidebar */}
      <div
        className="relative w-full overflow-hidden rounded-md border border-border cursor-pointer group"
        onClick={() => setFullscreen(true)}
      >
        <MapContent
          spots={spots}
          hoveredId={hoveredId}
          onHover={onHover}
          fullscreen={false}
          selectedSpot={null}
          onSelectSpot={() => setFullscreen(true)}
          onDeselectSpot={() => {}}
          userLocator={userLocator}
        />
        {/* Bouton agrandir */}
        <div className="absolute top-2 right-2 rounded bg-card/80 border border-border p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>

      {/* Modal plein écran */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => { setFullscreen(false); setSelectedSpot(null); }}
        >
          <div
            className="relative w-[95vw] max-w-[1600px] rounded-xl border border-border bg-[oklch(0.13_0.01_250)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                Carte DX — Zones CQ
              </h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {spots.filter((s) => s.dx_latitude != null).length} spots positionnés
                </span>
                <button
                  onClick={() => { setFullscreen(false); setSelectedSpot(null); }}
                  className="rounded border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Carte grande */}
            <div className="overflow-hidden rounded-lg border border-border">
              <MapContent
                spots={spots}
                hoveredId={hoveredId}
                onHover={onHover}
                fullscreen={true}
                selectedSpot={selectedSpot}
                onSelectSpot={handleSelectSpot}
                onDeselectSpot={handleDeselectSpot}
                userLocator={userLocator}
              />
            </div>

            {/* Légende bandes */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Bandes :</span>
              {Object.entries(BAND_COLORS).map(([band, color]) => (
                <span key={band} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <span className="font-mono text-[10px] font-bold" style={{ color }}>{band}</span>
                </span>
              ))}
              <span className="ml-4 flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="font-mono text-[10px] font-bold text-red-400">QTH</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
