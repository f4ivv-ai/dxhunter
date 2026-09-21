/**
 * Mini-carte de propagation pour la page Forecast.
 * Affiche les zones cibles sous forme de cercles positionnés sur une projection
 * équirectangulaire, colorés par score de propagation moyen du jour sélectionné.
 * Un trait relie le QTH de l'utilisateur à chaque zone.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Zone avec score de propagation */
interface ZoneScore {
  zoneId: string;
  label: string;
  avg: number;
  peak: number;
}

/** Coordonnées des zones cibles (alignées sur CALIB_ZONES du serveur) */
const ZONE_COORDS: Record<string, { lat: number; lon: number }> = {
  eu_e: { lat: 50.4, lon: 30.5 },
  scand: { lat: 60.2, lon: 24.9 },
  me: { lat: 29.4, lon: 47.9 },
  ua9: { lat: 55.0, lon: 82.9 },
  us_e: { lat: 40.7, lon: -74.0 },
  vu: { lat: 28.6, lon: 77.2 },
  carib: { lat: 18.0, lon: -66.0 },
  zs: { lat: -26.2, lon: 28.0 },
  py: { lat: -23.5, lon: -46.6 },
  us_w: { lat: 34.0, lon: -118.2 },
  ja: { lat: 35.7, lon: 139.7 },
  sea: { lat: 3.1, lon: 101.7 },
  vk: { lat: -33.9, lon: 151.2 },
  zl: { lat: -41.3, lon: 174.8 },
};

const W = 600;
const H = 300;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y];
}

function scoreToColor(score: number): string {
  if (score >= 70) return "#34d399"; // emerald-400
  if (score >= 55) return "#4ade80"; // green-400
  if (score >= 40) return "#facc15"; // yellow-400
  if (score >= 25) return "#fb923c"; // orange-400
  return "#f87171"; // red-400
}

function scoreToOpacity(score: number): number {
  return 0.4 + (score / 100) * 0.6;
}

interface ForecastMapProps {
  zones: ZoneScore[];
  userLat: number;
  userLon: number;
  className?: string;
}

export function ForecastMap({ zones, userLat, userLon, className }: ForecastMapProps) {
  const [qthX, qthY] = useMemo(() => project(userLon, userLat), [userLon, userLat]);

  const zoneMarkers = useMemo(() => {
    return zones.map((z) => {
      const coords = ZONE_COORDS[z.zoneId];
      if (!coords) return null;
      const [x, y] = project(coords.lon, coords.lat);
      return { ...z, x, y };
    }).filter(Boolean) as (ZoneScore & { x: number; y: number })[];
  }, [zones]);

  return (
    <div className={cn("relative rounded-lg border border-border/50 bg-[oklch(0.12_0.005_250)] overflow-hidden", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ minHeight: 160 }}
      >
        {/* Grille de fond */}
        <defs>
          <pattern id="grid" width="33.33" height="33.33" patternUnits="userSpaceOnUse">
            <path d="M 33.33 0 L 0 0 0 33.33" fill="none" stroke="oklch(0.25 0.005 250)" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Lignes de latitude/longitude principales */}
        {[-60, -30, 0, 30, 60].map(lat => {
          const y = ((90 - lat) / 180) * H;
          return <line key={`lat${lat}`} x1={0} y1={y} x2={W} y2={y} stroke="oklch(0.3 0.005 250)" strokeWidth="0.5" strokeDasharray="4 4" />;
        })}
        {[-120, -60, 0, 60, 120].map(lon => {
          const x = ((lon + 180) / 360) * W;
          return <line key={`lon${lon}`} x1={x} y1={0} x2={x} y2={H} stroke="oklch(0.3 0.005 250)" strokeWidth="0.5" strokeDasharray="4 4" />;
        })}

        {/* Lignes QTH → zones */}
        {zoneMarkers.map((z) => (
          <line
            key={`line-${z.zoneId}`}
            x1={qthX}
            y1={qthY}
            x2={z.x}
            y2={z.y}
            stroke={scoreToColor(z.avg)}
            strokeWidth="0.8"
            strokeOpacity={0.3}
            strokeDasharray="3 2"
          />
        ))}

        {/* Marqueur QTH */}
        <circle cx={qthX} cy={qthY} r={5} fill="#60a5fa" stroke="#fff" strokeWidth="1.5" />
        <text x={qthX} y={qthY - 8} textAnchor="middle" className="fill-blue-300 text-[8px] font-bold font-mono">
          QTH
        </text>

        {/* Marqueurs zones */}
        {zoneMarkers.map((z) => (
          <g key={z.zoneId}>
            <circle
              cx={z.x}
              cy={z.y}
              r={Math.max(8, z.avg / 8)}
              fill={scoreToColor(z.avg)}
              fillOpacity={scoreToOpacity(z.avg)}
              stroke={scoreToColor(z.avg)}
              strokeWidth="1"
              strokeOpacity={0.8}
            />
            {/* Score au centre */}
            <text
              x={z.x}
              y={z.y + 3}
              textAnchor="middle"
              className="fill-white text-[7px] font-bold font-mono"
              style={{ textShadow: "0 0 3px rgba(0,0,0,0.8)" }}
            >
              {z.avg}
            </text>
            {/* Label sous le cercle */}
            <text
              x={z.x}
              y={z.y + Math.max(8, z.avg / 8) + 9}
              textAnchor="middle"
              className="fill-muted-foreground text-[6px] font-mono"
            >
              {z.label.split("(")[0].trim().slice(0, 12)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
