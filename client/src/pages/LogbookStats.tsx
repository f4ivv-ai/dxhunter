/**
 * Page LogbookStats — Statistiques du logbook QSO.
 * Graphiques : QSO par bande, par mode, activité 30 jours, progression DXCC cumulée.
 * Graphiques SVG natifs (pas de dépendance externe).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useVisitorId } from "@/hooks/useVisitorId";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BookOpen,
  Globe,
  Radio,
  TrendingUp,
  Zap,
  BarChart3,
  Target,
  Pencil,
  Check,
} from "lucide-react";

const LOGO = "/manus-storage/dxhunter-logo_11361b71.png";

const BAND_COLORS: Record<string, string> = {
  "160m": "#8b5cf6",
  "80m": "#3b82f6",
  "40m": "#06b6d4",
  "30m": "#10b981",
  "20m": "#f59e0b",
  "17m": "#f97316",
  "15m": "#ef4444",
  "12m": "#ec4899",
  "10m": "#a855f7",
  "6m": "#14b8a6",
  "2m": "#84cc16",
};

const MODE_COLORS: Record<string, string> = {
  SSB: "#3b82f6",
  CW: "#f59e0b",
  FT8: "#8b5cf6",
  FT4: "#06b6d4",
  AM: "#10b981",
  FM: "#ef4444",
  RTTY: "#f97316",
};

// ─── Graphique barres horizontal ─────────────────────────────────────────────
function HBarChart({
  data,
  colorMap,
  defaultColor = "#6366f1",
  maxItems = 12,
}: {
  data: [string, number][];
  colorMap?: Record<string, string>;
  defaultColor?: string;
  maxItems?: number;
}) {
  const top = data.slice(0, maxItems);
  const max = Math.max(...top.map(([, v]) => v), 1);
  return (
    <div className="space-y-1.5">
      {top.map(([label, value]) => {
        const pct = (value / max) * 100;
        const color = colorMap?.[label] || defaultColor;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0 text-right">
              {label}
            </span>
            <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="font-mono text-xs font-bold tabular-nums w-8 text-right"
              style={{ color }}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Graphique barres vertical (activité daily) ───────────────────────────────
function DailyChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const H = 80;
  const W = 8;
  const GAP = 2;
  const total = data.length;
  const svgW = total * (W + GAP);

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={H + 20} className="block">
        {data.map((d, i) => {
          const barH = Math.max((d.count / max) * H, d.count > 0 ? 3 : 0);
          const x = i * (W + GAP);
          const y = H - barH;
          const isToday = i === data.length - 1;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={W}
                height={barH}
                rx={2}
                fill={isToday ? "#f59e0b" : "#6366f1"}
                opacity={isToday ? 1 : 0.7}
              />
              {/* Label jour (tous les 7j + aujourd'hui) */}
              {(i % 7 === 0 || isToday) && (
                <text
                  x={x + W / 2}
                  y={H + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#6b7280"
                  fontFamily="monospace"
                >
                  {d.day.slice(5)}
                </text>
              )}
              {/* Tooltip valeur */}
              {d.count > 0 && (
                <text
                  x={x + W / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#9ca3af"
                  fontFamily="monospace"
                >
                  {d.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Graphique ligne (progression DXCC) ──────────────────────────────────────
function LineChart({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) return (
    <p className="text-center font-mono text-xs text-muted-foreground py-4">Aucune donnée</p>
  );
  const W = 600;
  const H = 120;
  const PAD = { top: 10, right: 20, bottom: 30, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + innerH - (d.count / maxVal) * innerH,
    label: d.month,
    count: d.count,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `${points[0].x},${PAD.top + innerH}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${PAD.top + innerH}`,
  ].join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 300 }}>
        {/* Grille horizontale */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD.top + innerH - frac * innerH;
          const val = Math.round(frac * maxVal);
          return (
            <g key={frac}>
              <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
                stroke="#374151" strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end"
                fontSize={8} fill="#6b7280" fontFamily="monospace">{val}</text>
            </g>
          );
        })}
        {/* Aire */}
        <polygon points={area} fill="#10b981" opacity={0.12} />
        {/* Ligne */}
        <polyline points={polyline} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="#10b981" />
            {/* Label mois (tous les 3) */}
            {i % 3 === 0 && (
              <text x={p.x} y={PAD.top + innerH + 18} textAnchor="middle"
                fontSize={8} fill="#6b7280" fontFamily="monospace">
                {p.label.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Carte stat ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className={cn("rounded-lg p-2", color)}>{icon}</div>
      <div>
        <div className="font-mono text-2xl font-extrabold tabular-nums text-foreground">{value}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LogbookStats() {
  const visitorId = useVisitorId();

  const { data: stats, isLoading } = trpc.logbook.stats.useQuery(
    { visitorId },
    { enabled: !!visitorId }
  );

  // Objectif DXCC personnalisé
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.get.useQuery(
    { visitorId },
    { enabled: !!visitorId }
  );
  const setGoalMutation = trpc.settings.setDxccGoal.useMutation({
    onSuccess: () => refetchSettings(),
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const dxccGoal = settingsData?.dxccGoal ?? 100;

  // Activité totale des 30 derniers jours
  const totalLast30 = useMemo(
    () => stats?.daily.reduce((acc, d) => acc + d.count, 0) ?? 0,
    [stats]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-[oklch(0.16_0.009_250)]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/logbook" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={LOGO} alt="DX Hunter" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-mono text-base font-extrabold tracking-tight text-foreground leading-none">
              STATISTIQUES
            </h1>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              Analyse de votre activité QSO et progression DXCC
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/logbook"
              className="flex items-center gap-1.5 rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold text-violet-400 hover:bg-violet-500/20 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logbook</span>
            </Link>
            <Link
              href="/dxcc"
              className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">DXCC</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Corps */}
      <div className="flex-1 p-3 sm:p-5 max-w-5xl mx-auto w-full space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground font-mono text-sm">
            Chargement des statistiques...
          </div>
        ) : !stats || stats.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <BarChart3 className="h-16 w-16 text-muted-foreground/20" />
            <p className="font-mono text-sm text-muted-foreground">Aucun QSO dans le logbook</p>
            <Link
              href="/logbook"
              className="mt-2 flex items-center gap-1.5 rounded border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 font-mono text-xs font-bold text-violet-400 hover:bg-violet-500/20 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" /> Aller au logbook
            </Link>
          </div>
        ) : (
          <>
            {/* Cartes résumé */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Barre de progression DXCC vers l'objectif */}
            {stats.dxccCount > 0 && (
              <div className="rounded-lg border border-border bg-card p-4 col-span-2 sm:col-span-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-400" />
                    Progression vers l'objectif DXCC
                  </h2>
                  <div className="flex items-center gap-2">
                    {editingGoal ? (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={340}
                          value={goalInput}
                          onChange={(e) => setGoalInput(e.target.value)}
                          className="w-16 rounded border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const v = parseInt(goalInput, 10);
                            if (v >= 1 && v <= 340) {
                              setGoalMutation.mutate({ visitorId, dxccGoal: v });
                            }
                            setEditingGoal(false);
                          }}
                          className="rounded border border-emerald-500/40 bg-emerald-500/10 p-1 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setGoalInput(String(dxccGoal)); setEditingGoal(true); }}
                        className="flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Objectif : {dxccGoal}
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative h-4 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min((stats.dxccCount / dxccGoal) * 100, 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{stats.dxccCount} travaillés</span>
                  <span>{Math.max(dxccGoal - stats.dxccCount, 0)} restants · {Math.min(Math.round((stats.dxccCount / dxccGoal) * 100), 100)}%</span>
                </div>
              </div>
            )}
              <StatCard
                icon={<Radio className="h-5 w-5 text-primary" />}
                label="QSO total"
                value={stats.total}
                color="bg-primary/10"
              />
              <StatCard
                icon={<Globe className="h-5 w-5 text-emerald-400" />}
                label="DXCC travaillés"
                value={stats.dxccCount}
                color="bg-emerald-500/10"
              />
              <StatCard
                icon={<Zap className="h-5 w-5 text-amber-400" />}
                label="QSO (30 jours)"
                value={totalLast30}
                color="bg-amber-500/10"
              />
              <StatCard
                icon={<BarChart3 className="h-5 w-5 text-cyan-400" />}
                label="Bandes actives"
                value={stats.byBand.length}
                color="bg-cyan-500/10"
              />
            </div>

            {/* Activité 30 jours */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-400" />
                Activité — 30 derniers jours
              </h2>
              <DailyChart data={stats.daily} />
            </div>

            {/* Bande + Mode côte à côte */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  QSO par bande
                </h2>
                <HBarChart data={stats.byBand} colorMap={BAND_COLORS} />
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  QSO par mode
                </h2>
                <HBarChart data={stats.byMode} colorMap={MODE_COLORS} defaultColor="#6366f1" />
              </div>
            </div>

            {/* Progression DXCC */}
            {stats.dxccCumul.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  Progression DXCC cumulée
                </h2>
                <LineChart data={stats.dxccCumul} />
                <p className="mt-2 text-right font-mono text-[10px] text-muted-foreground">
                  {stats.dxccCount} entités DXCC travaillées au total
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
