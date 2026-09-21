/**
 * ContestMode — Panneau de gestion du mode concours.
 * Affiche le concours actif, les stats, la liste des multiplicateurs par bande,
 * et permet de démarrer/arrêter une session.
 * Collapsible comme SelfMonitor.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Trophy, ChevronUp, ChevronDown, Play, Square, Zap, List, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ContestMultList } from "@/components/ContestMultList";
import { ContestLog } from "@/components/ContestLog";

// ─── Panneau collapsible ─────────────────────────────────────────────────────

export function ContestModeCollapsible() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("dx-contest-collapsed") === "1"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem("dx-contest-collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const { data: stats } = trpc.contest.stats.useQuery(undefined, {
    refetchInterval: 5000,
  });

  return (
    <section className="border-b border-border">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-card/50"
      >
        <Trophy className="h-4 w-4 text-amber-400" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          Mode Contest
        </span>
        {stats && (
          <span className="ml-auto mr-2 text-[10px] text-muted-foreground font-mono">
            {stats.totalQsos} QSO · {stats.totalMults} Multi
          </span>
        )}
        {!stats && (
          <span className="ml-auto mr-2 text-[10px] text-muted-foreground">
            Inactif
          </span>
        )}
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {!collapsed && <ContestModePanel />}
    </section>
  );
}

// ─── Panneau principal ───────────────────────────────────────────────────────

function ContestModePanel() {
  const { data: session, refetch: refetchSession } = trpc.contest.getSession.useQuery();
  const { data: contests } = trpc.contest.listContests.useQuery();
  const { data: stats } = trpc.contest.stats.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: workedData } = trpc.contest.getWorkedData.useQuery(undefined, {
    enabled: !!session,
    refetchInterval: 5000,
  });

  const startMut = trpc.contest.startSession.useMutation({
    onSuccess: () => {
      refetchSession();
      toast.success("Contest démarré !");
    },
  });
  const endMut = trpc.contest.endSession.useMutation({
    onSuccess: () => {
      refetchSession();
      toast.info("Contest terminé");
    },
  });

  const [selectedContest, setSelectedContest] = useState("CQWW_SSB");
  const [category, setCategory] = useState<"MULTI_ONE" | "SINGLE_OP">("MULTI_ONE");
  const [mycall, setMycall] = useState("F4IVV");
  const [showMults, setShowMults] = useState(false);
  const [showLog, setShowLog] = useState(true); // Log ouvert par défaut quand session active

  // Worked mult keys from backend
  const workedMultKeys = useMemo(() => workedData?.worked?.multKeys || [], [workedData]);

  // Heard mult keys from current spots (detected via useContestStatus on the parent)
  // For simplicity, we derive heard mults from the workedData structure
  // The "heard" mults are those spotted but not yet worked — we can't easily get this here
  // without the spots. We'll pass an empty set for now and let the parent provide it.
  const heardMultKeys = useMemo(() => new Set<string>(), []);

  if (session) {
    const contest = contests?.find((c) => c.id === session.contestId);
    const bands = contest?.bands || ["160", "80", "40", "20", "15", "10"];

    // Session active — afficher les stats
    return (
      <div className="px-4 pb-3 space-y-3">
        {/* Header concours actif */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-foreground">
                {stats?.contestName || session.contestId}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {session.category === "MULTI_ONE" ? "Multi-One" : "Single-Op"} · {session.mycall}
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm("Terminer la session de concours ?")) endMut.mutate();
            }}
            className="flex items-center gap-1 rounded border border-destructive/50 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </div>

        {/* Stats par bande */}
        {stats && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatBox label="QSOs" value={stats.totalQsos} color="text-foreground" />
              <StatBox label="Multis" value={stats.totalMults} color="text-amber-400" />
              <StatBox
                label="Score"
                value={stats.totalQsos * stats.totalMults}
                color="text-primary"
              />
            </div>

            {/* Bandes */}
            <div className="grid grid-cols-6 gap-1">
              {stats.bandStats.map((b) => (
                <div
                  key={b.band}
                  className="rounded border border-border bg-card/50 p-1.5 text-center"
                >
                  <div className="text-[9px] text-muted-foreground">{b.band}m</div>
                  <div className="text-xs font-bold text-foreground">{b.qsos}</div>
                  <div className="text-[9px] text-amber-400">{b.mults}M</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Carnet de trafic (ouvert par défaut) */}
        {showLog && (
          <div className="border-t border-border/50 pt-2">
            <ContestLog contestId={session.contestId} mycall={session.mycall || "F4IVV"} category={session.category || "SINGLE_OP"} />
          </div>
        )}

        {/* Légende couleurs */}
        <div className="flex items-center gap-3 text-[10px] border-t border-border pt-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/90" />
            <span className="text-muted-foreground">Multi</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted/60" />
            <span className="text-muted-foreground">Fait</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-foreground/80" />
            <span className="text-muted-foreground">À faire</span>
          </span>
          <button
            onClick={() => setShowLog(!showLog)}
            className={cn(
              "ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold transition-all active:scale-95",
              showLog
                ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="h-3 w-3" />
            Log
          </button>
          <button
            onClick={() => setShowMults(!showMults)}
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold transition-all active:scale-95",
              showMults
                ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3 w-3" />
            Mults
          </button>
        </div>

        {/* Liste des multiplicateurs par bande */}
        {showMults && (
          <div className="border-t border-border/50 pt-2">
            <ContestMultList
              contestId={session.contestId}
              bands={bands}
              workedMultKeys={workedMultKeys}
              heardMultKeys={heardMultKeys}
            />
          </div>
        )}
      </div>
    );
  }

  // Pas de session active — formulaire de démarrage
  return (
    <div className="px-4 pb-3 space-y-3">
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Concours
        </label>
        <select
          value={selectedContest}
          onChange={(e) => setSelectedContest(e.target.value)}
          className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground"
        >
          {contests?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Catégorie
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          >
            <option value="MULTI_ONE">Multi-One</option>
            <option value="SINGLE_OP">Single-Op</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Indicatif
          </label>
          <input
            value={mycall}
            onChange={(e) => setMycall(e.target.value.toUpperCase())}
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground font-mono"
          />
        </div>
      </div>

      <button
        onClick={() =>
          startMut.mutate({
            contestId: selectedContest,
            category,
            mycall,
            power: "HIGH",
          })
        }
        disabled={startMut.isPending}
        className="flex w-full items-center justify-center gap-2 rounded bg-amber-500/90 px-3 py-2 text-xs font-bold text-black transition-all hover:bg-amber-400 active:scale-[0.97]"
      >
        <Play className="h-3.5 w-3.5" />
        Démarrer le Contest
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded border border-border bg-card/50 px-2 py-1.5">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold font-mono tabular-nums", color)}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
