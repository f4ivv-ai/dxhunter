import { Recommendation } from "@/lib/pilot";
import { cn } from "@/lib/utils";
import { Compass, Radio, Ear, Target, ArrowUpRight } from "lucide-react";

const ROLE_STYLE: Record<Recommendation["role"], { cls: string; icon: typeof Radio }> = {
  RUN: { cls: "border-phosphor/50 bg-phosphor/10 text-phosphor", icon: Radio },
  MULT: { cls: "border-primary/50 bg-primary/10 text-primary", icon: Target },
  "IN-BAND": { cls: "border-cyan-400/50 bg-cyan-400/10 text-cyan-300", icon: Radio },
  ÉCOUTE: { cls: "border-amber-400/40 bg-amber-400/10 text-amber-300", icon: Ear },
};

function scoreColor(s: number): string {
  if (s >= 65) return "text-phosphor";
  if (s >= 45) return "text-primary";
  if (s >= 25) return "text-amber-400";
  return "text-muted-foreground";
}

/**
 * Recommandations "maintenant" : zones triées par priorité avec cap, chemin
 * (SP/LP), rôle conseillé et activité live. C'est le cœur du pilotage.
 */
export function RecoPanel({ recos }: { recos: Recommendation[] }) {
  const top = recos.slice(0, 8);
  return (
    <div className="space-y-2">
      {top.map((r) => {
        const rs = ROLE_STYLE[r.role];
        const Icon = rs.icon;
        const az = r.prop.path === "LP" ? Math.round(r.prop.lpAz) : Math.round(r.prop.spAz);
        return (
          <div
            key={r.zone.id}
            className="rounded-lg border border-border bg-[oklch(0.19_0.009_250)] p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-bold text-foreground">
                    {r.zone.label}
                  </span>
                  <span className="shrink-0 rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                    {r.zone.ituNote}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Compass className="h-3 w-3" />
                    <span className="font-mono font-bold text-foreground">{az}°</span>
                    <span>{r.prop.path === "LP" ? "(LP)" : "(SP)"}</span>
                  </span>
                  <span className="font-mono">{Math.round(r.prop.distance).toLocaleString("fr-FR")} km</span>
                  {r.liveSpots > 0 && (
                    <span className="flex items-center gap-1 text-phosphor">
                      <ArrowUpRight className="h-3 w-3" />
                      {r.liveSpots} live
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] italic text-muted-foreground/80">{r.note}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                    rs.cls
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {r.role}
                </span>
                <span className={cn("font-mono text-lg font-extrabold leading-none", scoreColor(r.prop.score))}>
                  {r.prop.score}
                </span>
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">ouvert.</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
